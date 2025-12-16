#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;

///////////////////////////////////////////////////////////////////////////////
// Material
///////////////////////////////////////////////////////////////////////////////
uniform vec3 material_color = vec3(1, 1, 1);
uniform float material_metalness = 0;
uniform float material_fresnel = 0.04;
uniform float material_shininess = 0;
uniform vec3 material_emission = vec3(0);

uniform int has_color_texture = 0;
layout(binding = 1) uniform sampler2D colorMap;
uniform int has_emission_texture = 0;
layout(binding = 5) uniform sampler2D emissiveMap;

///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////
layout(binding = 6) uniform sampler2D environmentMap;
layout(binding = 7) uniform sampler2D irradianceMap;
layout(binding = 8) uniform sampler2D reflectionMap;
uniform float environment_multiplier;

///////////////////////////////////////////////////////////////////////////////
// Light source
///////////////////////////////////////////////////////////////////////////////
uniform vec3 point_light_color = vec3(1.0, 1.0, 1.0);
uniform float point_light_intensity_multiplier = 50.0;

///////////////////////////////////////////////////////////////////////////////
// Constants
///////////////////////////////////////////////////////////////////////////////
#define PI 3.14159265359

///////////////////////////////////////////////////////////////////////////////
// Input varyings from vertex shader
///////////////////////////////////////////////////////////////////////////////
in vec2 texCoord;
in vec3 viewSpaceNormal;
in vec3 viewSpacePosition;
in vec3 worldNormalOut;


///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse;
uniform vec3 viewSpaceLightPosition;

///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;



vec3 calculateDirectIllumiunation(vec3 wo, vec3 n, vec3 base_color)
{
	   // Directional light from the sun (view space)
    vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition); //find the dir from point to the sun


    float NdotL = max(dot(n, wi), 0.0); //how directly is sun hitting the spot

    vec3 diffuse = base_color * NdotL * point_light_color * point_light_intensity_multiplier;

    return diffuse;
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n, vec3 base_color)
{
    // Convert view space normal to world space
    vec3 nWorld = normalize(worldNormalOut);
    
    // Diffuse IBL (ambient)
    vec2 envUV = vec2(
        atan(nWorld.z, nWorld.x) / (2.0 * PI) + 0.5,
        asin(nWorld.y) / PI + 0.5
    );
    vec3 irradiance = texture(irradianceMap, envUV).rgb;
    vec3 diffuseIBL = base_color * irradiance;
    
    // Specular IBL (reflections)
    // Convert view direction to world space
    vec3 viewPosWorld = (viewInverse * vec4(viewSpacePosition, 1.0)).xyz;
    vec3 cameraPosWorld = (viewInverse * vec4(0, 0, 0, 1)).xyz;
    vec3 woWorld = normalize(cameraPosWorld - viewPosWorld);
    
    vec3 r = reflect(-woWorld, nWorld);
    
    vec2 reflUV = vec2(
        atan(r.z, r.x) / (2.0 * PI) + 0.5,
        asin(r.y) / PI + 0.5
    );
    
    vec3 reflection = texture(reflectionMap, reflUV).rgb;
    vec3 specularIBL = reflection * material_fresnel;
    
    return environment_multiplier * (diffuseIBL + specularIBL);
}

void main()
{
	float visibility = 1.0;
	float attenuation = 1.0;

	vec3 wo = -normalize(viewSpacePosition);
	vec3 n = normalize(viewSpaceNormal);

	vec3 base_color = material_color;
	if(has_color_texture == 1)
	{
		base_color = base_color * texture(colorMap, texCoord).rgb;
	}

	// Direct illumination
	vec3 direct_illumination_term = visibility * calculateDirectIllumiunation(wo, n, base_color);

	// Indirect illumination
	vec3 indirect_illumination_term = calculateIndirectIllumination(wo, n, base_color);

	///////////////////////////////////////////////////////////////////////////
	// Add emissive term. If emissive texture exists, sample this term.
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission * material_color;
	if(has_emission_texture == 1)
	{
		emission_term = texture(emissiveMap, texCoord).rgb;
	}

	vec3 shading = direct_illumination_term + indirect_illumination_term + emission_term;

	fragmentColor = vec4(shading, 1.0);
	return;
}
