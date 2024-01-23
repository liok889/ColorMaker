// texture coordinates
varying vec2 oTexCoord;

// uniforms
uniform float hPitch;
uniform float vPitch;
uniform sampler2D colorDiff;
uniform sampler2D colorDiffScale;
uniform bool outputColor;

// kernel half size (3 equates to a 7x7 kernel)
const int KHS = 2;

void main() 
{
	vec2 inTexCoord = vec2(0.0, 1.0) + vec2(1.0, -1.0)*oTexCoord;
	float c00 =  texture2D(colorDiff, inTexCoord).x;
	float diff = 0.0;
	
	// run kernel
	for (int i=-KHS; i<= KHS; i++) 
	{
		for (int j=-KHS; j<= KHS; j++) 
		{
			vec2 offset = vec2( float(i), float(-j) );
			vec2 texCoord = inTexCoord + offset * vec2(hPitch, vPitch);

			float c = texture2D(colorDiff, texCoord).x;
			//diff = max(diff, abs(c00 - c));
			diff += abs(c00-c);
		}
	}
	diff /= pow( float(KHS*2+1), 2.0 ) * 4.0;

	//diff /= 10.0;
	if (outputColor) {
		gl_FragColor = texture2D(colorDiffScale, vec2(diff, 0.5));
	}
	else {
		gl_FragColor = vec4(diff, diff, diff, 1.0);
	}
}
