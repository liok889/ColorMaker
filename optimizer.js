
// number of controls keys the algorithm controls directly
// note that this is adjustable by the algorithm now, so can't
// be assumed constant
var DESIRED_KEYS = 25;
var KEYS = DESIRED_KEYS;

// how many times to try to get a random neighbor displayable
// lab color before giving up (falling back to original color)
var RANDOM_COLOR_TRIES = 50;

// optimization parameters
// =====================
var ITERATIONS_PER_TEMP = 5500;


// initial/final annealing temperature
var INITIAL_TEMP = 1.0;
var FINAL_TEMP = 0.0001;

// amount to reduce temperature by
var ALPHA_TEMP = 0.925;

// minimum LAB-unit distance between potentially confuseable color pairs
var MIN_CONFUSION_DIST = 70;

// tapers the amount of random walk we should do
var TAPER_WALK_LEN = 1;

// vector math
// ===========
function length(v)
{
    var l =
        Math.pow(v[0],2) +
        Math.pow(v[1],2) +
        Math.pow(v[2],2);
    return Math.sqrt(l);
}

function length2(v)
{
    var l =
        Math.pow(v[0],2) +
        Math.pow(v[1],2);
    return Math.sqrt(l);
}

function normalize(v) {
    var l = length(v);
    if (l > 0) {
        l = 1/l;
        v[0] *= l;
        v[1] *= l;
        if (v.length>2) {
            v[2] *= l;
        }
    }
    return v;
}

function normalize2(v) {
    var l = length2(v);
    if (l > 0) {
        l = 1/l;
        v[0] *= l;
        v[1] *= l;
    }
    return v;
}


function rotate2(v, rad)
{
    var cosine = Math.cos(rad);
    var sine = Math.sin(rad);

    return [
        v[0] * cosine - v[1] * sine,
        v[0] * sine   + v[1] * cosine
    ];
}

function dot(v1, v2)
{
    return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
}
function dot2(v1, v2)
{
    return v1[0]*v2[0] + v1[1]*v2[1];
}

function delta(v1, v2)
{
    return [ v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2] ];
}

function distanceLAB(lab1, lab2)
{
    var v1 = [lab1.l, lab1.a, lab1.b];
    var v2 = [lab2.l, lab2.a, lab2.b];
    return length(delta(v1, v2));
}

/* --consts for cie delta 2000 ----- */
var TWO_PI = 2*Math.PI;
var SIX = 6*Math.PI/180;
var TWENTY_FIVE = 25 * Math.PI/180;
var THIRTY = 30*Math.PI/180;
var SIXTY = 2 * THIRTY;
var SIXTY_THREE = SIXTY + SIX/2;
var TWO_SEVENTY_FIVE = 275 * Math.PI/180;

var C25 = Math.pow(25, 7);

function _cie2000Diff(c1, c2)
{
	// lightness
	var L1 = c1.l;
	var L2 = c2.l;
	var dL = L2 - L1;

	var a1 = c1.a, a2 = c2.a;
	var b1 = c1.b, b2 = c2.b;

	var b1_2 = Math.pow(b1, 2);
	var b2_2 = Math.pow(b2, 2);

	// chroma
	var C1 = Math.sqrt(Math.pow(a1,2) + b1_2);
	var C2 = Math.sqrt(Math.pow(a2,2) + b2_2);


	var L = .5 * (L1 + L2); //if (L1>0 && L2>0) L /= 2;
	var C = .5 * (C1 + C2); //if (C1>0 && C2>0) C /= 2;
	var C7   = Math.pow(C , 7);

	// (delcared globally) var C25  = Math.pow(25, 7);
	var C725 = Math.sqrt(C7/(C7+C25));

	var a1_ = a1 + .5 * a1 * (1 - C725);
	var a2_ = a2 + .5 * a2 * (1 - C725);

	var C1_ = Math.sqrt(Math.pow(a1_, 2) + b1_2);
	var C2_ = Math.sqrt(Math.pow(a2_, 2) + b2_2);
	var C_  = .5 * (C1_ + C2_); //if (C1_>0 && C2_>0) C_ /= 2;
	var dC = C2_ - C1_;

	// compute hue angle diffrentials
	var dh, dH, H;

	var h1 = Math.atan2(b1, a1_) % TWO_PI;
	var h2 = Math.atan2(b2, a2_) % TWO_PI;

	// note: an indeterminate atan2 happens when both b and a are 0
	// In this case, the Math.atan2 returns 0, which is what is assumed in the following
	// calculations
	var h21 = h2 - h1;

	if (C1_ == 0 || C2_ == 0) {
		dh = 0;
		dH = 0;
		//console.log("dH is 0");
	}
	else
	{
		dh = (Math.abs(h21) <= Math.PI ? h21 : (h2<=h1 ? h21+TWO_PI : h21-TWO_PI));
		dH = 2 * Math.sqrt(C1_ * C2_) * Math.sin(.5 * dh);
	}

	if (Math.abs(h21) <= Math.PI) {
		H = h1 + h2;
	}
	else if (h1+h2 < TWO_PI)
	{
		H = h1 + h2 + TWO_PI;
	}
	else
	{
		H = h1 + h2 - TWO_PI;
	}

	if (C1_ != 0 || C2_ != 0) {
		H *= .5;
	}

	var T = 1 -
		0.17 * Math.cos(H - THIRTY) +
		0.24 * Math.cos(2*H) +
		0.32 * Math.cos(3*H + SIX) -
		0.20 * Math.cos(4*H - SIXTY_THREE);

	var L50 = Math.pow(L - 50, 2);
	var SL = 1 + 0.015 * L50 / (Math.sqrt(20 + L50));
	var SC = 1 + 0.045 * C_;
	var SH = 1 + 0.015 * C_ * T;

	var expH = Math.pow( (H - TWO_SEVENTY_FIVE) / TWENTY_FIVE, 2);
	var RT =
		-2 * C725 *
		Math.sin(SIXTY * Math.exp( -expH ));

	var dCSC = dC/SC;
	var dHSH = dH/SH;

	var deltaE00_2 =
		Math.pow(dL/SL,2) +
		Math.pow(dCSC, 2) +
		Math.pow(dHSH, 2) +
		RT * dCSC * dHSH;

	return Math.sqrt(deltaE00_2);
}

// searches for an offset direction for target so that it can be pushed
// away a minimum distance
//
function offsetInColorspace(target, confuser, minD, rotationDir, actTarget, actConfuser)
{
    var OFFSET_TESTS = 10;
    var DIST_STEPS = 6;
    var MAX_DIST_MULTIPLY=3;

    // actual target/confuser (target, confuser could be CVD transformed)
    if (!actTarget) actTarget=target;
    if (!actConfuser) actConfuser=confuser;

    // rotation direction, either -1 or 1, selected randomly or supplied
    if (true || !rotationDir) {
        rotationDir = Math.random() > 0.5 ? 1 : -1;
    }

    // do we have a CVD model? If so, model effect on confuser/target pair
    var cvdModel = null; //getCVDModel();
    /*
    var cvdConfuser;
    if (cvdModel)
    {
        cvdConfuser = cvdModel.transformLAB(d3.lab(confuser[0], confuser[1], confuser[2]));
    }
    */

    var tV = [target[1], target[2]];
    var cV = [confuser[1], confuser[2]];

    // offset between target and confuser
    var dV = [tV[0] - cV[0], tV[1]- cV[1]]
    var d = length2(dV);
    var initial = [ dV[0]/d, dV[1]/d ];

    // length of column that keeps us within minD arc away from confuser
    var l = Math.sqrt(Math.pow(minD, 2) - Math.pow(d, 2));
    var rV = rotate2(initial, Math.PI/2);

    // point on arc with max angle
    var bV = [ tV[0] + rV[0]*l, tV[1] + rV[1]*l ];

    // find the maximum permissible arc angle
    // (one that keeps us going in the direciton away from confuser)
    var v2 = [bV[0]-cV[0], bV[1]-cV[1]];
    normalize2(v2);
    var maxArc = Math.acos(dot2(initial, v2));

    var actualOffset = null;

    for (var dir=0; dir<2 && !actualOffset; dir++, rotationDir *= -1)
    {
        for (var o=0; o<OFFSET_TESTS && !actualOffset; o++)
        {
            var angle = rotationDir * maxArc * (o/(OFFSET_TESTS-1));
            var offset = rotate2(initial, angle);

            for (var _d=0, _tries=cvdModel ? DIST_STEPS : 1; _d<_tries && !actualOffset; _d++)
            {
                var testDistance = (MAX_DIST_MULTIPLY * minD) * (_d/(DIST_STEPS-1)) + minD;

                var newTarget = [
                    actConfuser[1] + offset[0] * testDistance,
                    actConfuser[2] + offset[1] * testDistance
                ];


                // make sure offset keeps us within the CVD color space

                if (cvdModel) {
                    var modeledTarget = d3.lab(
                        target[0],
                        cV[0]+offset[0] * testDistance,
                        cV[1]+offset[1] * testDistance
                    );

                    if (!cvdModel.colorInModel(modeledTarget)) {
                        // outside gamut of CVD, so angle won't work
                        break;
                    }

                }

                // now if new target is within color space
                var newTargetLab = d3.lab(actTarget[0], newTarget[0], newTarget[1]);

                if (newTargetLab.displayable())
                {
                    if (cvdModel)
                    {
                        // see if new target is more than minD from confuser after CVD transform
                        var cvdTarget = cvdModel.transformLAB(newTargetLab);
                        var distanceCVD = length(delta(
                            confuser,
                            [cvdTarget.l, cvdTarget.a, cvdTarget.b]
                        ));
                        if (distanceCVD >= minD) {
                            actualOffset = [0, offset[0], offset[1]];
                        }
                    }
                    else {
                        actualOffset = [0, offset[0], offset[1]];
                    }
                }
                else {
                    // outside of gamut, stop increasing offset distance
                    break;
                }
            }
        }
    }
    return actualOffset;
}



function perceptualUniformityPenalty(solution, sampleRate)
{
    var SAMPLE_PERCEPT = 50;
    var controls = sampleColors(solution, sampleRate || SAMPLE_PERCEPT)

    var meanDist = 0;
    var distances = [];
    for (var i=0, len=controls.length-1; i<len; i++)
    {
        var c1 = controls[i];
        var c2 = controls[i+1];
        //var offset = delta(c1, c2);
        //var distance = length(offset);
        var distance = _cie2000Diff(
            {l: c1[0], a: c1[1], b: c1[2]},
            {l: c2[0], a: c2[1], b: c2[2]}
        );
        meanDist += distance;

        distances.push(distance);
    }
    meanDist /= controls.length-1;

    var stdDist = 0;
    for (var i=0, len=distances.length; i<len; i++)
    {
        stdDist += Math.pow(distances[i]-meanDist, 2);
    }
    var penalty = Math.sqrt( stdDist / (distances.length-1) ) / meanDist;
    return penalty;
}

function anglePenalty(solution, sampleRate)
{
    var SAMPLE_ANGLE = 20;
    var controls = sampleColors(solution, sampleRate || SAMPLE_ANGLE)
    var cosinePenalty = 0;
    for (var i=0, len=controls.length-2; i<len; i++)
    {
        var c1 = controls[i];
        var c2 = controls[i+1];
        var c3 = controls[i+2];

        var d1 = delta(c2, c1);
        var d2 = delta(c3, c2);

        var cosine = dot(d1, d2) / (length(d1)*length(d2));

        // transform cosine penalty to [0, 1] range
        cosinePenalty += cosine * -.5 + .5;
    }
    return cosinePenalty / (controls.length-2);
}

function copySolution(solution)
{
    if (!solution) {
        return null;
    }
    else {
        var newCopy = [];
        for (var i=0, len=solution.length; i<len; i++) {
            newCopy.push(solution[i].slice());
        }
        return newCopy;
    }
}

var SMOOTHNESS_RANGE = [0, 10];
var SMOOTHNESS = 3;
function adjustSmoothness(val)
{
    SMOOTHNESS = val * (SMOOTHNESS_RANGE[1]-SMOOTHNESS_RANGE[0]) + SMOOTHNESS_RANGE[0];

}

function adjustNameSalience(val)
{

}

function cvdPenalty(solution, cvdSolution)
{
    //cvdSolution = null;
    var lumProfile = getLuminanceProfile();
    var keyCount = lumProfile.getKeyMultiples(20);
    var confusionPairs = lumProfile.getConfusionPairs(keyCount);

    var totalCost = 0;
    var cvdModel = getCVDModel();

    if (!cvdModel || confusionPairs.length < 1)
    {
        return 0;
    }
    else {

        // sample solution to new keyCount

        var sampledSolution = sampleColors(solution, keyCount);
        cvdSolution = [];
        for (var i=0; i<keyCount; i++) {
            var color = sampledSolution[i];
            var cvdColor = cvdModel.transformLAB(d3.lab(color[0], color[1], color[2]));
            cvdSolution.push([cvdColor.l, cvdColor.a, cvdColor.b]);
        }


        var likelihoods = 0;
        var totalCost = 0;

        /*
        if (!cvdSolution) {
            cvdSolution = [];
            for (var i=0, len=solution.length; i<len; i++)
            {
                var color = solution[i];
                var cvdColor = cvdModel.transformLAB(d3.lab(color[0], color[1], color[2]));
                cvdSolution.push([cvdColor.l, cvdColor.a, cvdColor.b]);
            }
        }
        */

        for (var p=0, len=confusionPairs.length; p<len; p++)
        {
            var pair = confusionPairs[p];
            var cvdColor1 = cvdSolution[pair.k1];
            var cvdColor2 = cvdSolution[pair.k2];
            var likelihood = pair.likelihood;

            var minDistance = MIN_CONFUSION_DIST * likelihood;
            var cvdDistance = length(delta(cvdColor1, cvdColor2));

            if (cvdDistance < minDistance) {
                totalCost += (1-cvdDistance/minDistance);
                likelihoods += likelihood;
            }
        }
        return totalCost/confusionPairs.length;
        //return likelihoods > 0 ? totalCost / likelihoods : 0; //confusionPairs.length;
    }
}

var smoothness_weights = [
    {w: 3, keyModifier: 1},
    {w0: 1, keyModifier: 0.5, userControlled: true}
];

function costFunction(solution, cvdSolution)
{
    /*
    var costs = [
        {w: 2,  c: perceptualUniformityPenalty(solution)},
        {w: 4,  c: anglePenalty(solution, 75)},
        {w: 4,  c: anglePenalty(solution, 50)},
        {w: 3,  c: anglePenalty(solution, 20)},
        {w: 1,  c: anglePenalty(solution, 10)},
    ];
    */

    var CVD_WEIGHT = 5;

    var WEIGHTS = [
        // preceptual uniformity costs
        {w: 2.5,  c: perceptualUniformityPenalty(solution)},
        //{w: 4,  c: anglePenalty(solution, 75)},
        //{w: 3,  c: anglePenalty(solution, 50)},
        //{w: 3,  c: anglePenalty(solution, 25)},
        //{w: SMOOTHNESS,  c: anglePenalty(solution, 10)},

        // CVD penalty
        {w: getCVDModel() ? CVD_WEIGHT : 0, c: cvdPenalty(solution, cvdSolution)}
    ];

    var totalCost = 0, weights=0;
    for (var i=0, len=WEIGHTS.length; i<len; i++) {
        totalCost += WEIGHTS[i].w * WEIGHTS[i].c;
        weights += WEIGHTS[i].w;
    }

    var lum = getLuminanceProfile();
    for (var i=0, len=smoothness_weights.length; i<len; i++)
    {
        var w = smoothness_weights[i].w;
        if (lum.isDiverging() && smoothness_weights[i].userControlled) {
            w *= .4;
        }
        else if (lum.isWave() && smoothness_weights[i].userControlled)
        {
            w *= 1/.4;
        }
        totalCost += w * anglePenalty(solution, smoothness_weights[i].samples);
        weights += w;
    }
    return totalCost / weights;

}

var maxBiasLength = 0;


function randomNeighbor(solution, index, preferences, confusers, taperWalkLen)
{

    var A_BIAS = 0;//(Math.floor(Math.random() * 3)-1)*.015;
    var B_BIAS = 0;//(Math.floor(Math.random() * 3)-1)*.015;

    // length of random walk, in LAB units
    var MIN_W_LENGTH = 2; (taperWalkLen || 1);
    var MAX_W_LENGTH = 6; (taperWalkLen || 1);

    // how much to weigh user bias
    // against a random vector
    var cvdModel = getCVDModel();
    var BIAS_BLEND = cvdModel ? .5 : .6
    var AWAY_BLEND = cvdModel ? .4 : .65;

    function randomWalk(oldColor, bias, away)
    {
        var cvdModel = getCVDModel();
        var displayable = false;
        var newColor;

        // try finding a newColor that's randomly offset from oldColor
        // and that's still displayable
        for (var t=0; !displayable && t<RANDOM_COLOR_TRIES; t++)
        {
            var v = [
                0,
                2*(Math.random()-.5 + A_BIAS),
                2*(Math.random()-.5 + B_BIAS)
            ];
            normalize(v);

            // random length between min_w_length and max_w_length

            if (bias) {
                // if there is bias, blend it
                //normalize(bias);
                v[0] = (1-BIAS_BLEND) * v[0] + BIAS_BLEND * bias[0];
                v[1] = (1-BIAS_BLEND) * v[1] + BIAS_BLEND * bias[1];
                v[2] = (1-BIAS_BLEND) * v[2] + BIAS_BLEND * bias[2];
                normalize(v);
            }
            if (away) {
                v[0] = (1-AWAY_BLEND) * v[0] + AWAY_BLEND * away[0];
                v[1] = (1-AWAY_BLEND) * v[1] + AWAY_BLEND * away[1];
                v[2] = (1-AWAY_BLEND) * v[2] + AWAY_BLEND * away[2];
                normalize(v);
            }

            // weigh the resulting vector
            var w = Math.random() * (MAX_W_LENGTH-MIN_W_LENGTH) + MIN_W_LENGTH;
            v[0] *= w; v[1] *= w; v[2] *= w;

            // compose a new color
            newColor = [
                oldColor[0] + v[0],
                oldColor[1] + v[1],
                oldColor[2] + v[2]
            ];
            var newLab = d3.lab(newColor[0], newColor[1], newColor[2]);
            displayable =
                newLab.displayable() /*&&
                (!cvdModel || cvdModel.colorInModel(newLab));*/
            /*
            if (displayable && cvdModel)
            {
                newLab = cvdModel.deTransformLAB(newLab);

                newColor = [
                    newLab.l,
                    newLab.a,
                    newLab.b,
                ];
            }
            */
        }

        // return the random vector
        if (displayable) {
            return newColor;
        }
        else {
            return oldColor;
        }
    }

    function biasToPrefs(curColor, prefs)
    {
        var totalBias = [0, 0, 0];
        for (i=0, len=prefs.length; i<len; i++)
        {
            var biasVector = prefs[i];
            var target = [curColor[0], biasVector.preference[1], biasVector.preference[2]]

            // is target displayable?
            if (true || d3.lab(target[0], target[1], target[2]).displayable()) {

                // accumulate bias towards the target
                var d = delta(curColor, target);

                normalize(d);

                totalBias[0] += d[0] * biasVector.relativeStrength;
                totalBias[1] += d[1] * biasVector.relativeStrength;
                totalBias[2] += d[2] * biasVector.relativeStrength;
            }
        }

        // assess the length of the bias vector
        var biasL = length(totalBias);
        var relative = biasL / MAX_PREF_STRENGTH;

        // limit the length of bias vector to 1
        relative = Math.min(relative, 1.0);

        normalize(totalBias);
        totalBias[0] *= relative;
        totalBias[1] *= relative;
        totalBias[2] *= relative;

        maxBiasLength = Math.max(maxBiasLength, relative);

        return totalBias;
    }

    function awayFromConfusers(solution, curColor, confs, index)
    {
        var cvdModel = null;//getCVDModel();
        var cvdCurColor = cvdModel ? cvdModel.transformLAB(d3.lab(curColor[0], curColor[1], curColor[2])) : null;


        var offset = [0, 0, 0];
        var maxL = 0;
        for (var i=0, len=confs.length; i<len; i++)
        {
            // confusion likelihood
            var likelihood = confs[i].likelihood;

            // confuser color to push away from
            var confColor = solution[confs[i].confuser];
            var cvdConfColor = cvdModel ? cvdModel.transformLAB(d3.lab(confColor[0], confColor[1], confColor[2])) : null;

            var distance = cvdModel ? distanceLAB(cvdCurColor, cvdConfColor) : length(delta(confColor, curColor));

            //if (distance < MIN_CONFUSION_DIST)
            var minD = (cvdModel ? MIN_CONFUSION_DIST : MIN_CONFUSION_DIST*.7) * likelihood;
            if (distance < minD)
            {
                // scale likelihood by distance so that max offset effect is
                // when distance is 0 and min is when dist i MIN_CONFUSION_DIST
                //likelihood *= (1 - distance/MIN_CONFUSION_DIST)

                // find offset that's within the color space
                var localOffset;

                // default rotation direction
                var rotationDir = index%2==0 ? 1 : -1;
                if (false)
                {
                    // CVD modeling
                    localOffset = offsetInColorspace
                    (
                        //curColor, confColor,

                        // use CVD transformed colors to compute proper offset
                        [cvdCurColor.l, cvdCurColor.a, cvdCurColor.b],
                        [cvdConfColor.l, cvdConfColor.a, cvdConfColor.b],
                        minD * .6, rotationDir,
                        curColor, confColor
                    );
                }
                else {
                    /*
                    var offset = delta(confColor, curColor);
                    offset[0] = 0;
                    normalize(offset);
                    localOffset = [0, offset[1], offset[2]]
                    */
                    localOffset = offsetInColorspace(curColor, confColor, minD, rotationDir);
                }

                if (localOffset)
                {
                    offset[1] += likelihood * localOffset[1];
                    offset[2] += likelihood * localOffset[2];
                    maxL = Math.max(maxL, likelihood);
                }

            }

        }
        if (confs.length > 0 && maxL > 0)
        {
            normalize(offset);
            offset[0] *= maxL;
            offset[1] *= maxL;
            offset[2] *= maxL;
        }
        return offset;
    }

    var neighbor = copySolution(solution);

    // randomize only one color indexed by index
    var _bias = preferences ? biasToPrefs(neighbor[index], preferences[index]) : null;
    var _away = confusers ? awayFromConfusers(solution, neighbor[index], confusers[index], index) : null;

    neighbor[index] = randomWalk(neighbor[index], _bias, _away);
    return neighbor;
}


function linearInterp(controls, alpha)
{
        var a = alpha * (controls.length-1);
        var i1 = Math.floor(a);
        var i2 = Math.ceil(a);
        var c1 = controls[i1];
        var c2 = controls[i2];

        var b = a-i1;
        return [
            b * (c2[0]-c1[0]) + c1[0],
            b * (c2[1]-c1[1]) + c1[1],
            b * (c2[2]-c1[2]) + c1[2]
        ];
}

function sampleColors(controls, n)
{
    var sample = [];

    for (var i=0, _n=n-1; i<n; i++) {
        sample.push(linearInterp(controls, i/_n));
    }
    return sample;
}


function Optimizer()
{
}

Optimizer.prototype.randomSolution = function()
{
    var controlPoints = [];

    var luminanceGenerator = getLuminanceProfile();

    // make sure the number of keys is a multiple of getKeyMultiples()
    // this ensures that important luminance control points (e.g., peaks)
    // get their own key
    this.keyCount = luminanceGenerator.getKeyMultiples(DESIRED_KEYS);
    for (var i=0; i<this.keyCount; i++)
    {
        var L = luminanceGenerator.getLuminance(i/(this.keyCount-1));
        controlPoints.push([L, 0, 0]);
    }

    var cvdModel = getCVDModel();
    var initial = copySolution(controlPoints);

    for (var i=0; i<initial.length; i++)
    {
        var c = initial[i];
        var displayable = false;

        for (j=0; j<RANDOM_COLOR_TRIES && !displayable; j++)
        {

            c[1] = Math.random() * [+80+94] -80;//200 - 100;
            c[2] = Math.random() * 200 - 100;
            var labC = d3.lab(c[0], c[1], c[2]);
            displayable =
                labC.displayable() /* &&
                (!cvdModel || cvdModel.colorInModel(labC)); */
            /*
            if (displayable && cvdModel)
            {
                labC = cvdModel.deTransformLAB(labC);
                c[0] = labC.l;
                c[1] = labC.a;
                c[2] = labC.b;
            }*/
        }
        if (!displayable) {
            c[1] = 0; c[2] = 0;
        }
    }
    return initial;
}

Optimizer.prototype.estimateTotalIteration = function(initialT, finalT, alpha)
{
    var initialTemp = initialT || INITIAL_TEMP;
    var finalTemp = finalT || FINAL_TEMP;
    var alpha = alpha || ALPHA_TEMP;
    var totalIters = 0;

    var temp = initialTemp;
    while (temp >= finalTemp) {
        totalIters += ITERATIONS_PER_TEMP;
        temp = temp * alpha;
    }
    return totalIters;
}

function simulateCVDSolution(solution, olderCVDSolution, indexChange)
{
    var cvdModel = getCVDModel();
    if (!cvdModel) {
        return null;
    }
    else {
        var i0 = olderCVDSolution ? indexChange : 0;
        var i1 = olderCVDSolution ? indexChange : solution.length;

        if (!olderCVDSolution)
        {
            olderCVDSolution = [];
            olderCVDSolution.length = solution.length;
        }

        for (var i=i0; i<i1; i++)
        {
            var color = solution[i];
            var cvdColor = cvdModel.transformLAB(d3.lab(
                color[0], color[1], color[2]
            ));
            olderCVDSolution[i] = [
                cvdColor.l, cvdColor.a, cvdColor.b
            ];
        }
        return olderCVDSolution;
    }
}

Optimizer.prototype.optimize = function(userBias, exitEvery, initialSolution)
{
    var iterCount = ITERATIONS_PER_TEMP;
    var initialTemp = INITIAL_TEMP;
    var finalTemp = FINAL_TEMP;
    var alpha = ALPHA_TEMP;

    // initialize smoothness weights
    if (!this.lastState)
    {
        var lumProfile = getLuminanceProfile();
        for (var i=0, len=smoothness_weights.length; i<len; i++) {
            var k = Math.floor(DESIRED_KEYS * smoothness_weights[i].keyModifier);
            var samples = lumProfile.getKeyMultiples(k);
            console.log('smoothness samples: ' + samples + ', k: ' + k);
            smoothness_weights[i].samples = samples;
            if (smoothness_weights[i].userControlled) {
                smoothness_weights[i].w = SMOOTHNESS * smoothness_weights[i].w0;
            }
        }
    }
    // figure out total number of iterations so that we can
    // estimate time needed
    var finalIterCount = this.estimateTotalIteration(initialTemp, finalTemp, alpha);

    // copy initial solution
    var solution;
    if (this.lastState) {
        // use 'saved' solution from last state
        solution = this.lastState.solution;
    }
    else if (initialSolution)
    {
        // use initial solution provided
        solution = copySolution(initialSolution);
    }
    else {
        // otherwise start randomly
        solution = this.randomSolution();
    }

    // CVD-simualted version of the solution
    var cvdSolution = this.lastState ? this.lastState.cvdSolution : simulateCVDSolution(solution);

    // current cost
    var curCost = costFunction(solution, cvdSolution);

    // any key pairs that needs to be de-confused
    // due to having roughly same luminance level
    var lumProfile = getLuminanceProfile();
    var confusionMap = lumProfile.getConfusionMap(solution.length);

    var temp = this.lastState ? this.lastState.temp : initialTemp;
    var tookDespiteHigherCost = this.lastState ? this.lastState.tookDespiteHigherCost : 0;
    var totalIter = this.lastState ? this.lastState.totalIter : 0;

    var startTime = Date.now();
    if (!this.lastState)
    {
        maxBiasLength = 0;
    }

    //var userBias = userModel.getBias();
    var terminate = false;
    while (!terminate)
    {
        var higherCostMove = 0;
        var avgP = 0;
        var avgDelta = 0;
        var avgHighDelta = 0, avgLowDelta = 0, highDeltaCount = 0, lowDeltaCount = 0;
        var taperWalk = TAPER_WALK_LEN;

        for (var iter=0; iter<iterCount; iter++)
        {
            var randomI = Math.floor(Math.random() * solution.length);
            var neighbor = randomNeighbor(solution, randomI, userBias, confusionMap, taperWalk);
            var cvdNeighbor = simulateCVDSolution(neighbor, copySolution(cvdSolution), randomI);

            var neighborCost = costFunction(neighbor, cvdNeighbor);
            var deltaCost = neighborCost - curCost;
            avgDelta += Math.abs(deltaCost);


            //var p = Math.exp(K * -deltaCost / temp);
            var K = 3;
            var p = 1/(1+Math.exp(K * deltaCost / temp))
            if (deltaCost <= 0 || Math.random() < p)
            {
                if (deltaCost > 0)
                {
                    avgP += p;
                    higherCostMove++;
                    tookDespiteHigherCost++;
                    avgHighDelta += deltaCost;
                    highDeltaCount++;
                }
                else {
                    avgLowDelta += deltaCost;
                    lowDeltaCount++;
                }

                // adopt neighbor as solution
                solution = neighbor;
                cvdSolution = cvdNeighbor;
                curCost = neighborCost;


                //cvdSolution = simulateCVDSolution(solution, cvdSolution, randomI)
            }
        }

        // save cur solution
        this.solution = solution;

        // keep track of iteration statistics
        avgP /= highDeltaCount || 1;
        avgDelta /= iterCount;
        totalIter += iterCount;

        avgHighDelta /= highDeltaCount;
        avgLowDelta /= lowDeltaCount;

        // print out summary info
        console.log("tmp: " + temp.toFixed(3) + ", p: " + avgP.toFixed(3) + ', avg-delta: ' + avgDelta.toFixed(3) + ', high cost: ' + higherCostMove + '/' + iterCount);

        // reduce temperature
        temp = temp * alpha;

        if (temp < finalTemp)
        {
            // reached final temperature
            terminate = true;
        }
        else if (exitEvery && (Date.now() - startTime >= exitEvery))
        {
            // not finished yet, but we spent more time than exitEvery
            // save current state and return to give UI chance to refresh
            this.lastState = {
                startTime: this.lastState ? this.lastState.startTime : startTime,
                percentDone: totalIter / finalIterCount,
                temp: temp,
                tookDespiteHigherCost: tookDespiteHigherCost,
                totalIter: totalIter,
                solution: solution,
                cvdSolution: cvdSolution
            };
            return false;
        }

    }
    //console.log("took despite higher cost: " + tookDespiteHigherCost + ", totalIter: " + totalIter)
    console.log("Final cost: " + curCost.toFixed(4), ", max bias: " + maxBiasLength.toFixed(4));

    // optimiazation complete, erase any saved state
    this.lastState = null;
    this.solutionCost = curCost;

    return true;
}

Optimizer.prototype.clearLastState = function() {
    this.lastState = null;
}

Optimizer.prototype.getSolution = function()
{
    return this.solution;
}
