
#include "heightfield.h"

#include <iostream>
#include <stdint.h>
#include <vector>
#include <glm/glm.hpp>
#include <stb_image.h>
#include <GL/glew.h>

using namespace glm;
using std::string;

HeightField::HeightField(void)
    : m_meshResolution(0)
    , m_vao(UINT32_MAX)
    , m_positionBuffer(UINT32_MAX)
    , m_uvBuffer(UINT32_MAX)
    , m_indexBuffer(UINT32_MAX)
    , m_numIndices(0)
    , m_texid_hf(UINT32_MAX)
    , m_texid_diffuse(UINT32_MAX)
    , m_heightFieldPath("")
    , m_diffuseTexturePath("")
{
}

void HeightField::loadHeightField(const std::string& heigtFieldPath)
{
	int width, height, components;
	stbi_set_flip_vertically_on_load(true);
	float* data = stbi_loadf(heigtFieldPath.c_str(), &width, &height, &components, 1);
	if(data == nullptr)
	{
		std::cout << "Failed to load image: " << heigtFieldPath << ".\n";
		return;
	}

	if(m_texid_hf == UINT32_MAX)
	{
		glGenTextures(1, &m_texid_hf);
	}
	glBindTexture(GL_TEXTURE_2D, m_texid_hf);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);

	glTexImage2D(GL_TEXTURE_2D, 0, GL_R32F, width, height, 0, GL_RED, GL_FLOAT,
	             data); // just one component (float)

	m_heightFieldPath = heigtFieldPath;

}

void HeightField::loadDiffuseTexture(const std::string& diffusePath)
{
	int width, height, components;
	stbi_set_flip_vertically_on_load(true);
	uint8_t* data = stbi_load(diffusePath.c_str(), &width, &height, &components, 3);
	if(data == nullptr)
	{
		std::cout << "Failed to load image: " << diffusePath << ".\n";
		return;
	}

	if(m_texid_diffuse == UINT32_MAX)
	{
		glGenTextures(1, &m_texid_diffuse);
	}

	glBindTexture(GL_TEXTURE_2D, m_texid_diffuse);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);

	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB8, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data); // plain RGB
	glGenerateMipmap(GL_TEXTURE_2D);

	std::cout << "Successfully loaded diffuse texture: " << diffusePath << ".\n";
}
/// Generate a grid mesh for the height field Task 1
void HeightField::generateMesh(int tesselation)
{
    m_meshResolution = tesselation; // how many square to make

    // Generate vertices - flat grid at Y=0
    std::vector<vec3> positions;
    std::vector<vec2> texCoords;

    float step = 2.0f / tesselation;  // From -1 to +1 = range of 2

    // Create vertices
    for (int z = 0; z <= tesselation; z++) { // go nord or east
        for (int x = 0; x <= tesselation; x++) { // go east or west
            // X,Z from -1 to +1
			float posX = -1.0f + x * step; // left to right
			float posZ = -1.0f + z * step; // bottom to top

            // Flat mesh at Y=0 (will be displaced in shader)
			positions.push_back(vec3(posX, 0.0f, posZ)); // y = 0 for now

            // Texture coordinates from 0 to 1 like putting the picture on the mesh/ground
			float texU = x / (float)tesselation; // left to right
			float texV = z / (float)tesselation; // bottom to top
			texCoords.push_back(vec2(texU, texV)); // u,v coordinates
        }
    }

    // Generate indices for triangle strips with primitive restart, simple triangle
    std::vector<unsigned int> indices;

    // For each quad, create 2 triangles (6 indices)
    for (int z = 0; z < tesselation; z++) {
        for (int x = 0; x < tesselation; x++) {
            // Calculate vertex indices for this quad
            int topLeft = z * (tesselation + 1) + x;
            int topRight = topLeft + 1;
            int bottomLeft = (z + 1) * (tesselation + 1) + x;
            int bottomRight = bottomLeft + 1;

            // First triangle: topLeft → topRight → bottomLeft
            indices.push_back(topLeft);
            indices.push_back(topRight);
            indices.push_back(bottomLeft);

            // Second triangle: topRight → bottomRight → bottomLeft
            indices.push_back(topRight);
            indices.push_back(bottomRight);
            indices.push_back(bottomLeft);


        }
    }

    m_numIndices = indices.size();

    // Create VAO and buffers
    glGenVertexArrays(1, &m_vao);
    glBindVertexArray(m_vao);

    // Position buffer
    glGenBuffers(1, &m_positionBuffer); 
    glBindBuffer(GL_ARRAY_BUFFER, m_positionBuffer);
    glBufferData(GL_ARRAY_BUFFER, positions.size() * sizeof(vec3), positions.data(), GL_STATIC_DRAW);
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 0, nullptr); // attribute 0: position for each vertex, 3 floats (x,y,z)
    glEnableVertexAttribArray(0); 

    // Texture coordinate buffer
    glGenBuffers(1, &m_uvBuffer);
    glBindBuffer(GL_ARRAY_BUFFER, m_uvBuffer);
    glBufferData(GL_ARRAY_BUFFER, texCoords.size() * sizeof(vec2), texCoords.data(), GL_STATIC_DRAW);
	glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 0, nullptr); // attribute 1: uv coordinates for each vertex, 2 floats (u,v)
    glEnableVertexAttribArray(1);

    // Index buffer
    glGenBuffers(1, &m_indexBuffer);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, m_indexBuffer);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), indices.data(), GL_STATIC_DRAW);

    // Clean up
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);

    // DEBUG OUTPUT - OUTSIDE THE LOOPS!
    std::cout << "DEBUG: Generated heightfield mesh with " << tesselation << "x" << tesselation
        << " quads (" << positions.size() << " vertices, "
        << m_numIndices << " indices)" << std::endl;

    // Print first few vertices to verify
    std::cout << "DEBUG: First 3 vertices:" << std::endl;
    for (int i = 0; i < 3 && i < positions.size(); i++) {
        std::cout << "  Vertex " << i << ": pos(" << positions[i].x << ", "
            << positions[i].y << ", " << positions[i].z << "), uv("
            << texCoords[i].x << ", " << texCoords[i].y << ")" << std::endl;
    }

    // Also print first few indices
    std::cout << "DEBUG: First 6 indices:" << std::endl;
    for (int i = 0; i < 6 && i < indices.size(); i++) {
        std::cout << "  Index " << i << ": " << indices[i] << std::endl;
        }
}

void HeightField::submitTriangles(void)
{
    if(m_vao == UINT32_MAX)
    {
        std::cout << "No vertex array is generated, cannot draw anything.\n";
        return;
    }
    std::cout << "DEBUG: submitTriangles() - Drawing with VAO " << m_vao
        << ", indices: " << m_numIndices << std::endl;

    // Bind the VAO (this binds all buffers automatically)
    glBindVertexArray(m_vao);

    // Draw using indexed triangles
    glDrawElements(GL_TRIANGLES, m_numIndices, GL_UNSIGNED_INT, nullptr);

    // Unbind VAO
    glBindVertexArray(0);

    std::cout << "DEBUG: submitTriangles() - Draw call completed" << std::endl;
}