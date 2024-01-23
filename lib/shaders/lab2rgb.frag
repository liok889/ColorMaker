#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

// texture coordinates
varying vec2 oTexCoord;

// lightness
uniform float L;

// background color
uniform vec3 background;

vec3 inverseF(vec3 t)
{
	const float delta  = 6.0/29.0;
	const float delta2 = delta * delta;

	vec3 high = pow(t, vec3(3.0));
	vec3 low = (t - 4.0/29.0) * (3.0 * delta2);

	bvec3 greater = greaterThan(t, vec3(delta));

	// models t > delta ? pow(t, 3.0) : (t - 4.0/29.0) * 3.0 * delta2
	return mix(low, high, vec3(greater));
}

vec3 lrgb2rgb(vec3 rgb)
{
	vec3 high = 12.92 * rgb;
	vec3 low  = 1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055;
	bvec3 less = lessThanEqual(rgb, vec3(0.0031308));

	// models: return (rgb <= 0.0031308 ? 12.92 * rgb : 1.055 * pow(rgb, 1.0 / 2.4) - 0.055)
	return mix(low, high, vec3(less));
}

vec3 xyz2rgb(vec3 xyz)
{
	const mat3 XYZ_2_LRGB = mat3(
		 3.1338561, -1.6168667, -0.4906146,
		-0.9787684,  1.9161415,  0.0334540,
		0.0719453, -0.2289914,  1.4052427
	);
	vec3 lrgb = xyz * XYZ_2_LRGB;
	return lrgb2rgb(lrgb);
}

vec3 lab2xyz(vec3 lab)
{
	const vec3 XYZn = vec3(0.96422, 1.0, 0.82521);

	float fYYn = (lab[0]+16.0) / 116.0; 
	float fXXn =  lab[1]/500.0 + fYYn;
	float fZZn = -lab[2]/200.0 + fYYn;

	return inverseF(vec3(fXXn, fYYn, fZZn)) * XYZn; 
}

vec3 lab2rgb(vec3 lab)
{
	return xyz2rgb( lab2xyz(lab) );
}

bool displayable(vec3 rgb)
{
	return all( lessThanEqual(rgb, vec3(1.0)) ) && all( greaterThanEqual(rgb, vec3(0.0)) ); 
}

void main()
{
	vec3 lab = vec3(L, mix(vec2(-112.0), vec2(112.0), oTexCoord));
	vec3 rgb = lab2rgb(lab);
	if (displayable(rgb)) {
		gl_FragColor = vec4(rgb, 1.0);
	}
	else
	{
		gl_FragColor = vec4(background, 1.0);
	}
}