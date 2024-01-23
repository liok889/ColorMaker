varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;
uniform float contour;

void main()
{
	float data = texture2D(scalarField, oTexCoord).x;

	vec2 colormapCoord = vec2(data, 0.5);
	if (contour >= 0.0 && abs(data-contour) < .0035)
	{
		gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
	}
	else
	{
		if (data >= 0.0)
		{
			gl_FragColor = texture2D(colormap, colormapCoord);
		}
		else
		{
			gl_FragColor = vec4(1.0);
			//gl_FragColor = mix(texture2D(colormap, colormapCoord), vec4(1.0), 0.7);
		}
	}
}
