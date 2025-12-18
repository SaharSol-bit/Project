#version 420

layout(location = 0) in vec3 position; // the dor position (vertice)
layout(location = 1) in vec2 texCoordIn; // the texture coordinate from the image

uniform mat4 modelMatrix; // model matrix of the terrain (move/scale the terrain)
uniform mat4 viewMatrix; // view matrix of the camera
uniform mat4 projectionMatrix; // projection matrix of the camera (3D to 2D)

uniform sampler2D heightTexture; // height map texture grayscale image (white = high, black = low))
uniform float heightScale; // the height of the mountains 

uniform vec3 terrainScale;  // how much the terrain is scaled in each axis (how big is terrain in world space)


//------output to the fragment shader------
out float heightValue;     // or out float isWater;
out vec3 worldPosOut;      // optional, but useful
out vec2 texCoord; // pass the texture coordinate to the fragment shader
out vec3 viewSpaceNormal; // pass the normal in view space to the fragment shader
out vec3 viewSpacePosition; // pass the position in view space to the fragment shader
uniform float textureWidth; //  width of the height texture
uniform vec2 heightTexelSize; // size of one texel in the height texture
out vec3 worldNormalOut; // pass the normal in world space to the fragment shader








void main()
{
    texCoord = texCoordIn; // pass through the texture coordinate

    float height = texture(heightTexture, texCoord).r; // sample the height from the height texture
    heightValue = height;

    vec3 worldPos = position; // start with the dor position
    worldPos.y = height * heightScale; // set the height of the vertex based on the height map
     
    // --- compute normal ---
    float du = heightTexelSize.x; // size of one texel in x direction
    float dv = heightTexelSize.y; // size of one texel in y direction

    float hL = texture(heightTexture, texCoord + vec2(-du, 0)).r; // height to the left
    float hR = texture(heightTexture, texCoord + vec2( du, 0)).r; // height to the right
    float hD = texture(heightTexture, texCoord + vec2(0, -dv)).r; // height down
    float hU = texture(heightTexture, texCoord + vec2(0,  dv)).r; // height up

    float sx = terrainScale.x; // scale in x direction
    float sz = terrainScale.z; // scale in z direction

    vec3 dX = vec3(2.0 * du * sx, (hR - hL) * heightScale, 0.0); // tangent in x direction
    vec3 dZ = vec3(0.0, (hU - hD) * heightScale, 2.0 * dv * sz); // tangent in z direction

    vec3 worldNormal = normalize(cross(dZ, dX)); // normal in world space
    //mat3 worldNormalMatrix = transpose(inverse(mat3(modelMatrix * modelMatrix))); // normal matrix for world space
    //worldNormalOut = normalize(worldNormalMatrix * worldNormal); // transform normal to world space
    worldNormalOut = worldNormal;

    // transform to view space
    mat3 normalMatrix = transpose(inverse(mat3(viewMatrix))); // normal matrix for view space
    viewSpaceNormal = normalize(normalMatrix * worldNormal); // transform normal to view space

    vec4 viewPos = viewMatrix * modelMatrix * vec4(worldPos, 1.0); // position in view space
    viewSpacePosition = viewPos.xyz; // pass the position in view space to fragment shader

    gl_Position = projectionMatrix * viewPos; // final position in clip space
}
