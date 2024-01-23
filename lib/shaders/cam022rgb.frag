// A shader to plot a Jab color space slice in RGB
// expects lightness (J value) as a uniform
// Code primarily taken from Connor Gramazio's d3-cam02 library
// https://github.com/connorgr/d3-cam02
// ============================================================

#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

// texture coordinates
varying vec2 oTexCoord;

// lightness
uniform float J;

// background color
uniform vec3 background;

// dimensions of the slice
uniform float width;
uniform float height;


// constants taken from d3-cam02
const float UCS_c1 = 0.007;
const float UCS_c2 = 0.0228;
const float UCS_k_l = 1.0;


const float CIECAM02_VC_D65_X = 95.047;
const float CIECAM02_VC_D65_Y = 100.0;
const float CIECAM02_VC_D65_Z = 108.883;
const float CIECAM02_VC_achromaticResponseToWhite = 25.515986676688584;
const float CIECAM02_VC_c = 0.69;
const float CIECAM02_VC_d = 0.8316553945340656;
const float CIECAM02_VC_f = 1.0;
const float CIECAM02_VC_fl = 0.27313053667320736;
const float CIECAM02_VC_la = 4.074366543152521;
const float CIECAM02_VC_n = 0.2;
const float CIECAM02_VC_nbb = 1.0003040045593807;
const float CIECAM02_VC_nc = 1.0;
const float CIECAM02_VC_ncb = 1.0003040045593807;
const float CIECAM02_VC_yb = 20.0;
const float CIECAM02_VC_z = 1.9272135954999579;

const float M_PI = 3.14159265359;
const float rad2deg = 180.0 / M_PI;

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

vec3 xyz2cat02(vec3 xyz) 
{
  const mat3 XYZ_2_CAT02 = mat3(
   0.7328,  0.4296, -0.1624,
   -0.7036, 1.6975, 0.0061,
   0.0030,  0.0136, 0.9834
  );
  return xyz * XYZ_2_CAT02;
}

vec3 cat022xyz(vec3 lms) {
  const mat3 LMS_2_XYZ = mat3(
    1.096124, -0.278869, 0.182745,
    0.454369,  0.473533,  0.072098,
    -0.009628, -0.005698, 1.015326  
  );
  return lms * LMS_2_XYZ;
}


vec3 hpe2xyz(vec3 lms) {
  const mat3 LMS_2_XYZ = mat3(
    1.910197, -1.112124, 0.201908,
    0.370950, 0.629054, -0.000008,
    0.0, 0.0, 1.0
  );
  return lms * LMS_2_XYZ;
}

vec3 Aab2Cat02LMS(vec3 Aab, float nbb) 
{
  const mat3 XAB_2_LMS = mat3(
    0.32787, 0.32145, 0.20527,
    0.32787, -0.63507, -0.18603,
    0.32787, -0.15681, -4.49038
  );

  vec3 xab = Aab * vec3(1.0/nbb, 1.0, 1.0) + vec3(0.305, 0.0, 0.0);
  return xab * XAB_2_LMS;
}


vec3 inverseNonlinearAdaptation(vec3 coneResponse, float fl) 
{
  return (100.0 / fl) *
          pow((27.13 * abs(coneResponse - 0.1)) /
                      (400.0 - abs(coneResponse - 0.1)),
                   vec3(1.0 / 0.42));
}

vec3 pre2rgb(vec3 x) 
{
  bvec3 less = lessThanEqual(x, vec3(0.0031308));
  vec3 high  = x * 12.92;
  vec3 low = 1.055 * pow(x, vec3(1.0 / 2.4)) - vec3(0.055);
  
  // models:  return x <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055);
  return mix(low, high, vec3(less));
}

vec3 xyz2rgb(vec3 xyz100) 
{
  const mat3 XYZ_2_RGB = mat3(
     3.2404542, -1.5371385, -0.4985314,
    -0.9692660, 1.8760108, 0.0415560,
     0.0556434, -0.2040259, 1.0572252
  );

  vec3 xyz = xyz100 / vec3(100.0);
  vec3 preRGB = xyz * XYZ_2_RGB;
  return pre2rgb(preRGB);
}



vec3 cam022rgb(float J, float C, float h) 
{
  // NOTE input is small h not big H, the later of which is corrected

  float t = pow(C / (sqrt(J / 100.0) *
                      pow(1.64-pow(0.29, CIECAM02_VC_n), 0.73)),
                  (1.0 / 0.9)),
      et = 1.0 / 4.0 * (cos(((h * M_PI) / 180.0) + 2.0) + 3.8);

  float a = pow( J / 100.0, 1.0 / (CIECAM02_VC_c * CIECAM02_VC_z) ) *
              CIECAM02_VC_achromaticResponseToWhite;

  float p1 = ((50000.0 / 13.0) * CIECAM02_VC_nc * CIECAM02_VC_ncb) * et / t,
      p2 = (a / CIECAM02_VC_nbb) + 0.305,
      p3 = 21.0 / 20.0,
      p4, p5, ca, cb;

  float hr = (h * M_PI) / 180.0;

  if (abs(sin(hr)) >= abs(cos(hr))) {
    p4 = p1 / sin(hr);
    cb = (p2 * (2.0 + p3) * (460.0 / 1403.0)) /
          (p4 + (2.0 + p3) * (220.0 / 1403.0) *
          (cos(hr) / sin(hr)) - (27.0 / 1403.0) +
          p3 * (6300.0 / 1403.0));
    ca = cb * (cos(hr) / sin(hr));
  }
  else {
    p5 = p1 / cos(hr);
    ca = (p2 * (2.0 + p3) * (460.0 / 1403.0)) /
         (p5 + (2.0 + p3) * (220.0 / 1403.0) -
         ((27.0 / 1403.0) - p3 * (6300.0 / 1403.0)) *
         (sin(hr) / cos(hr)));
    cb = ca * (sin(hr) / cos(hr));
  }

  vec3 lms_a = Aab2Cat02LMS(vec3(a, ca, cb), CIECAM02_VC_nbb);
  vec3 p = inverseNonlinearAdaptation(lms_a, CIECAM02_VC_fl);

  vec3 txyz = hpe2xyz(p);
  vec3 lms_c = xyz2cat02(txyz);

  vec3 D65_CAT02 = xyz2cat02( vec3(CIECAM02_VC_D65_X, CIECAM02_VC_D65_Y,
                            CIECAM02_VC_D65_Z));
  
  vec3 lms = lms_c / ( ( vec3(CIECAM02_VC_D65_Y * CIECAM02_VC_d) / D65_CAT02) +
                      vec3(1.0 - CIECAM02_VC_d) );


  vec3 xyz = cat022xyz(lms);
  return xyz2rgb(xyz);
}


vec3 jab2rgb(vec3 c) 
{

  float JJ = c.x, a = c.y, b = c.z;
  // Get the new M using trigonomic identities
  // MPrime = (1.0/coefs.c2) * Math.log(1.0 + coefs.c2*cam02.M); // log=ln
  // var a = MPrime * Math.cos(o.h),
  //     b = MPrime * Math.sin(o.h);
  // x*x = (x*cos(y))*(x(cos(y))) + (x*sin(y))*(x(sin(y)))
  float newMPrime = sqrt(a*a + b*b),
      newM = (exp(newMPrime * UCS_c2) - 1.0) / UCS_c2;

  float newh = rad2deg * atan2(b, a);
  if(newh < 0.0) newh = 360.0 + newh;

  // M = C * Math.pow(CIECAM02_VC_fl, 0.25);
  // C = M / Math.pow(CIECAM02_VC_fl, 0.25);
  float newC = newM / pow(CIECAM02_VC_fl, 0.25);

  // Last, derive the new Cam02J
  // JPrime = ((1.0 + 100.0*coefs.c1) * cam02.J) / (1.0 + coefs.c1 * cam02.J)
  // simplified: var cam02J = JPrime / (1.0 + coefs.c1*(100.0 - JPrime));
  // if v = (d*x) / (b + a*x), x = (b*(v/d)) / (1 - a(v/d))
  float newCam02J = JJ / (1.0 + UCS_c1*(100.0 - JJ));

  return cam022rgb(newCam02J, newC, newh);
}

// assumes the following range for texture
// var JAB_A_RANGE = [-45, 45];
// var JAB_B_RANGE = [-45, 45];

bool displayable(vec3 rgb)
{
  return all( lessThanEqual(rgb, vec3(1.0)) ) && all( greaterThanEqual(rgb, vec3(0.0)) ); 
}


bool cropOutOfGamut() 
{
  
  if (J >= 40.0) {
    return false;
  }
  else
  {
    // golden ratio
    const float G1 = 20.0 / 250.0;
    const float G2 = (160.0 - 20.0) / 250.0;
    float GH = height * G1;


    float limit = GH + height * G2 * (J/40.0);
    vec2 vlimit = vec2(-limit, limit);
    vec2 offLimitC = vec2(width/2.0) + vlimit;
    vec2 offLimitR = vec2(height/2.0 + GH) + vlimit;
    vec2 p = vec2(oTexCoord.x, 1.0-oTexCoord.y) * vec2(width, height);

    if  (!(p[0] >= offLimitC[0] && p[0] <= offLimitC[1] &&
    p[1] >= offLimitR[0] && p[1] <= offLimitR[1]))
    {
      return true;
    }
    else
    {
      return false;
    }
  }
}
void main() 
{
  
  if (cropOutOfGamut()) {
    gl_FragColor = vec4(background, 1.0);
  }
  else
  {
    float JPrime = ((1.0 + 100.0*UCS_c1) * J) / (1.0 + UCS_c1 * J);
    JPrime = JPrime / UCS_k_l;
    

    vec2 ab = mix(vec2(-45.0), vec2(45.0), vec2(oTexCoord.x, oTexCoord.y));
    vec3 rgb = jab2rgb(vec3(J, ab));

    
    if (displayable(rgb)) 
    {
      gl_FragColor = vec4(rgb, 1.0);
    }
    else {
      gl_FragColor = vec4(background, 1.0);
    }
  }
}

