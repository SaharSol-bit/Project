#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;
// it decides every color of the fragment, we give it info and tools and it computes the final color
///////////////////////////////////////////////////////////////////////////////
// Material
///////////////////////////////////////////////////////////////////////////////
uniform vec3 material_color = vec3(1, 1, 1); // base color, white by default
uniform float material_metalness = 0; // non-metallic by default
uniform float material_fresnel = 0.04; // Reflection intensity at grazing angles (0.04 is for non metals)


uniform vec3 material_emission = vec3(0); // self illumination color, black by default

uniform int has_color_texture = 0;
layout(binding = 1) uniform sampler2D colorMap; //satellite photo texture is binde to 1
uniform int has_emission_texture = 0;
layout(binding = 5) uniform sampler2D emissiveMap; //for glow effects

///////////////////////////////////////////////////////////////////////////////
// Environment from the main.cpp
///////////////////////////////////////////////////////////////////////////////
layout(binding = 6) uniform sampler2D environmentMap;
layout(binding = 7) uniform sampler2D irradianceMap;
layout(binding = 8) uniform sampler2D reflectionMap;
uniform float environment_multiplier;

///////////////////////////////////////////////////////////////////////////////
// Light source
///////////////////////////////////////////////////////////////////////////////
uniform vec3 point_light_color = vec3(1.0, 1.0, 1.0); // white light
uniform float point_light_intensity_multiplier = 1.0; // how bright the light is

///////////////////////////////////////////////////////////////////////////////
// Constants
///////////////////////////////////////////////////////////////////////////////
#define PI 3.14159265359

///////////////////////////////////////////////////////////////////////////////
// Input varyings from vertex shader
///////////////////////////////////////////////////////////////////////////////
in vec2 texCoord; // texture coordinates
in vec3 viewSpaceNormal; // normal in view space
in vec3 viewSpacePosition; // position in view space
in vec3 worldNormalOut; // normal in world space
in float heightValue;  // or in vec3 worldPosOut; then use worldPosOut.y


///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse; // inverse of view matrix
uniform vec3 viewSpaceLightPosition; // light position in view space
uniform vec3 terrainScale;  //x, y, z components

///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;


vec2 dirToEquirect(vec3 d)
{
    d = normalize(d);
    float theta = acos(clamp(d.y, -1.0, 1.0));
    float phi = atan(d.z, d.x);
    if(phi < 0.0) phi += 2.0 * PI;
    return vec2(phi / (2.0 * PI), 1.0 - theta / PI);
}



   
vec3 calculateDirectIllumiunation(vec3 wo, vec3 n, vec3 base_color)
{
	   // Directional light from the sun (view space)
    vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition); //find the dir from point/ground to the sun
    float distance = length(viewSpaceLightPosition - viewSpacePosition);


    
    float attenuation = 1.0 / (1.0 + 0.01 * distance + 0.0001 * distance * distance);
 
    float NdotL = max(dot(n, wi), 0.0); //how directly is sun hitting the spot

    vec3 diffuse = base_color * NdotL * point_light_color * point_light_intensity_multiplier * attenuation; // calculate the final sunlight color

    return diffuse;
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n, vec3 base_color, bool water)
{
    // Convert view space normal to world space
    vec3 nWorld = normalize(worldNormalOut);
    
    // Diffuse IBL (ambient)
     vec2 envUV = dirToEquirect(nWorld);

    

    vec3 irradiance = texture(irradianceMap, envUV).rgb;
    vec3 diffuseIBL = base_color * irradiance;
    
    // Specular IBL (reflections)
    // Convert view direction to world space
    vec3 viewPosWorld = (viewInverse * vec4(viewSpacePosition, 1.0)).xyz;
    vec3 cameraPosWorld = (viewInverse * vec4(0, 0, 0, 1)).xyz;
    vec3 woWorld = normalize(cameraPosWorld - viewPosWorld);
    
   

    vec3 r = reflect(-woWorld, nWorld);
    
    vec2 reflUV = dirToEquirect(r);

    
    vec3 reflection = texture(reflectionMap, reflUV).rgb;
    float waterReflect = water ? 1.0 : material_fresnel;
    vec3 specularIBL = reflection * waterReflect;

    
    return environment_multiplier * (diffuseIBL + specularIBL);
}




void main()
{
    float seaLevel = 0.0005; // tune
    bool water = heightValue < seaLevel;
	float visibility = 1.0;
	float attenuation = 1.0;

	vec3 wo = -normalize(viewSpacePosition);
	vec3 nView = normalize(viewSpaceNormal);



	vec3 base_color = material_color;
	if(has_color_texture == 1)
	{
		base_color = base_color * texture(colorMap, texCoord).rgb;
	}



    if (water)
    {
        base_color *= 0.2;
    }


	// Direct illumination
	vec3 direct_illumination_term = visibility * calculateDirectIllumiunation(wo, nView, base_color);

	// Indirect illumination
	vec3 indirect_illumination_term = calculateIndirectIllumination(wo, nView, base_color, water);




	///////////////////////////////////////////////////////////////////////////
	// Add emissive term. If emissive texture exists, sample this term.
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission * material_color;
	if(has_emission_texture == 1)
	{
		emission_term = texture(emissiveMap, texCoord).rgb;

	}
    vec3 shadingbak =
    direct_illumination_term +
    indirect_illumination_term +
    emission_term;

    // Distance-based fog
    float dist = length(viewSpacePosition);

    float fogStart = 200.0;
    float fogEnd   = 600.0;

    float fogT = clamp((dist - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
    fogT = fogT * fogT * (3.0 - 2.0 * fogT); // smoothstep curve
    fogT *= 0.0;;


	vec3 shading = direct_illumination_term + indirect_illumination_term + emission_term;

    // view direction in world space (camera looks along -viewSpacePosition)
vec3 viewDirView  = normalize(-viewSpacePosition);
vec3 viewDirWorld = normalize((viewInverse * vec4(viewDirView, 0.0)).xyz);

// spherical mapping to env UV
 vec2 bgUV = dirToEquirect(viewDirWorld);


vec3 background = texture(environmentMap, bgUV).rgb * environment_multiplier;


	vec3 finalColor = mix(shadingbak, background, fogT);
    fragmentColor = vec4(finalColor, 1.0);

	return;
}
