
const float M_PI = 3.1415926535897932384626433832795;
	
float atan2(float y, float x) 
{
	if (x > 0.0) {
		return atan(y/x);
	}
	else if (y > 0.0) {
		return M_PI/2.0 - atan(x/y);
	}
	else if (y < 0.0) {
		return -M_PI/2.0 - atan(x/y);
	}
	else if (x < 0.0) {
		return atan(y/x) + M_PI;
	}
	else
	{
		// undefined
		return -10000.0;
	}
}

// based on https://github.com/connorgr/colorgorical
float ciede2000(float Lstd, float astd, float bstd, float Lsample,
                 float asample, float bsample) 
{
  const float kl = 1.0;
  const float kc = 1.0;
  const float kh = 1.0;
  float Cabstd = sqrt(astd*astd + bstd*bstd);
  float Cabsample = sqrt(asample*asample + bsample*bsample);
  float Cabarithmean = (Cabstd + Cabsample)/2.0;
  float G = 0.5 * (1.0 - sqrt(pow(Cabarithmean, 7.0) /
             (pow(Cabarithmean, 7.0) + pow(25.0, 7.0))));
  // calculate a'
  float apstd = (1.0+G)*astd;
  float apsample = (1.0+G)*asample;
  float Cpsample = sqrt(apsample*apsample + bsample*bsample);
  float Cpstd = sqrt(apstd*apstd + bstd*bstd);
  // Compute the product of chromas and locations at which it is 0
  float Cpprod = Cpsample*Cpstd;
  // Make sure that hue is between 0 and 2pi
  float hpstd = atan2(bstd, apstd);
  if(hpstd < 0.0) hpstd += 2.0 * M_PI;
  float hpsample = atan2(bsample, apsample);
  if(hpsample < 0.0) hpsample += 2.0 * M_PI;
  float dL = Lsample - Lstd;
  float dC = Cpsample - Cpstd;
  // Compute hue distance
  float dhp = hpsample - hpstd;
  if(dhp > M_PI) dhp -= 2.0*M_PI;
  if(dhp < -1.0*M_PI) dhp += 2.0*M_PI;
  // Set chroma difference to zero if product of chromas is zero
  if(Cpprod == 0.0) dhp = 0.0;
  // CIEDE2000 requires signed hue and chroma differences, differing from older
  //  color difference formulae
  float dH = 2.0*sqrt(Cpprod)*sin(dhp/2.0);
  // Weighting functions
  float Lp = (Lsample+Lstd)/2.0;
  float Cp = (Cpstd+Cpsample)/2.0;
  // Compute average hue
  // avg hue is computed in radians and converted to degrees only where needed
  float hp = (hpstd+hpsample)/2.0;
  // Identify positions for which abs hue diff > 180 degrees
  if(abs(hpstd-hpsample) > M_PI) hp -= M_PI;
  // rollover those that are under
  if(hp < 0.0) hp += 2.0 * M_PI;
  // if one of the chroma values = 0, set mean hue to the sum of two chromas
  if(Cpprod == 0.0) hp = hpstd + hpsample;
  float Lpm502 = (Lp-50.0)*(Lp-50.0);
  float Sl = 1.0 + 0.015*Lpm502 / sqrt(20.0+Lpm502);
  float Sc = 1.0 + 0.045*Cp;
  float T = 1.0 - 0.17*cos(hp - M_PI/6.0)
               + 0.24*cos(2.0*hp)
               + 0.32*cos(3.0*hp + M_PI/30.0)
               - 0.20*cos(4.0*hp - 63.0*M_PI/180.0);
  float Sh = 1.0 + 0.015*Cp*T;
  float delthetarad = (30.0*M_PI/180.0) *
                       exp(-1.0* ( pow((180.0/M_PI*hp - 275.0)/25.0, 2.0) ));
  float Rc = 2.0*sqrt(pow(Cp, 7.0)/(pow(Cp, 7.0) + pow(25.0, 7.0)));
  float RT = -1.0 * sin(2.0*delthetarad)*Rc;
  float klSl = kl*Sl;
  float kcSc = kc*Sc;
  float khSh = kh*Sh;
  float de = sqrt( pow(dL/klSl, 2.0) + pow(dC/kcSc, 2.0) + pow(dH/khSh, 2.0) +
                    RT*(dC/kcSc)*(dH/khSh) );
  return de;
}

float labDiff(vec3 c1, vec3 c2) {
	return ciede2000(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z);
}

// transform from RGB to LAB
// adapted for GLSL, original code due to d3-color
// https://github.com/d3/d3-color
	
// D65 white point
const float Xn = 0.96422;
const float Yn = 1.0;
const float Zn = 0.82521;
const vec3 XYZn = vec3(Xn, Yn, Zn);
	
// _f function
const float t0 = 4.0 / 29.0;
const float t1 = 6.0 / 29.0;
const float t2 = 3.0 * t1 * t1;
const float t3 = t1 * t1 * t1;

vec3 rgb2lrgb(vec3 x) 
{
	bvec3 less = lessThanEqual(x, vec3(0.04045));
	vec3 high  = x / 12.92;
	vec3 low = pow((x + 0.055) / 1.055, vec3(2.4));
	
	// models: 	return (x) <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4);
	return mix(low, high, vec3(less));
}

vec3 _f(vec3 t) 
{
	bvec3 greater = greaterThan(t, vec3(t3));
	vec3 low  = t / vec3(t2) + vec3(t0);
	vec3 high = pow(t, vec3(1.0/3.0));
	// models: return t > t3 ? pow(t, 1.0 / 3.0) : t / t2 + t0;
	return mix(low, high, vec3(greater));
}

vec3 rgb2lab(vec3 o) 
{	
	// assumes sRGB at D65 white point		
	const mat3 RGB2XYZ = mat3(
		0.4360747, 0.3850649, 0.1430804,
		0.2225045, 0.7168786, 0.0606169,
		0.0139322, 0.0971045, 0.7141733
	);
	vec3 oxyz = _f( (rgb2lrgb(o) * RGB2XYZ) / XYZn );
	return vec3( 116.0 * oxyz.y - 16.0, 500.0 * (oxyz.x - oxyz.y), 200.0 * (oxyz.y - oxyz.z) );
}

uniform float hPitch;
uniform float vPitch;
varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;
uniform sampler2D colorDiffScale;
uniform bool outputColor;
	
float gauss(float x, float mue, float delta) {
	const float denominator = sqrt(2.0*M_PI);
	return exp(-0.5 * pow((x-mue)/delta, 2.0)) / (delta * denominator);
}
	
// kernel half size (3 equates to a 7x7 kernel)
const int KHS = 3;
void main() 
{
	vec3 c00 =  rgb2lab(texture2D(colormap, vec2(texture2D( scalarField, oTexCoord ).x, 0.5)).rgb);
	float diff = 0.0;
	// run kernel
	for (int i=-KHS; i<= KHS; i++) 
	{
		for (int j=-KHS; j<= KHS; j++) 
		{
			vec2 offset = vec2( float(i), float(j) );
			vec2 texCoord = oTexCoord + offset * vec2(hPitch, vPitch);
			vec3 c = rgb2lab(texture2D(colormap, vec2(texture2D( scalarField, texCoord ).x, 0.5)).rgb);
			float cDiff = labDiff(c00, c);
			
			//diff += cDiff * gauss( sqrt(dot(offset, vec2(1.0))), 0.0, float(KHS) / 2.1 );
			diff = max(diff, labDiff(c00, c));
		}
	}
	diff = diff / (10.0*float(1.0));
	if (outputColor) {
		gl_FragColor = texture2D(colorDiffScale, vec2(diff, 0.5));
	}
	else
	{
		gl_FragColor = vec4(diff, diff, diff, 1.0);
	}
}

