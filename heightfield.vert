#version 420

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texCoordIn;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

uniform sampler2D heightTexture;
uniform float heightScale;

out vec2 texCoord;
out vec3 viewSpaceNormal;
out vec3 viewSpacePosition;
uniform float textureWidth;
uniform vec2 heightTexelSize;
out vec3 worldNormalOut;


void main()
{
    texCoord = texCoordIn;

    float height = texture(heightTexture, texCoord).r;

    vec3 worldPos = position;
    worldPos.y = height * heightScale;

    // --- compute normal ---
    float du = heightTexelSize.x;
    float dv =heightTexelSize.y;

    float hL = texture(heightTexture, texCoord + vec2(-du, 0)).r;
    float hR = texture(heightTexture, texCoord + vec2( du, 0)).r;
    float hD = texture(heightTexture, texCoord + vec2(0, -dv)).r;
    float hU = texture(heightTexture, texCoord + vec2(0,  dv)).r;

    float sx = 500.0;
    float sz = 500.0;

    vec3 dX = vec3(2.0 * du * sx, (hR - hL) * heightScale, 0.0);
    vec3 dZ = vec3(0.0, (hU - hD) * heightScale, 2.0 * dv * sz);

    vec3 worldNormal = normalize(cross(dZ, dX));
    worldNormalOut = worldNormal;


    // transform to view space
    mat3 normalMatrix = transpose(inverse(mat3(viewMatrix * modelMatrix)));
    viewSpaceNormal = normalize(normalMatrix * worldNormal);

    vec4 viewPos = viewMatrix * modelMatrix * vec4(worldPos, 1.0);
    viewSpacePosition = viewPos.xyz;

    gl_Position = projectionMatrix * viewPos;
}
