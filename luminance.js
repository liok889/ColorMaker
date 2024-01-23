// cache
var CACHED_PAIRS = {};
var CACHED_MAPS = {};

// luminance range (default)
var LRANGE = [5, 95];

// pre-defined luminance profile
var PROFILE_DEFINED = null;

function getLuminanceProfile()
{
    // var profile = document.getElementById("lumProfile").value;
    var profile = PROFILE_DEFINED ? PROFILE_DEFINED : document.querySelector('input[name="lumProfile"]:checked').value;
    var inverted = false;
    if (profile.indexOf('_') != -1)
    {
        var tokens = profile.split("_");
        inverted = tokens[1] == "inverted";
        profile = tokens[0];
    }

    // recommended number of control points
    if (profile == 'linear') {
        DESIRED_KEYS=25;
    } else {
        DESIRED_KEYS=30;
    }


    return new LuminanceProfile(profile, inverted);
}

/* Object implements a simple luminance profile */
function LuminanceProfile(profile, invert)
{
    this.profile = [];
    this.profileType = profile;

    if (invert) {
        this.profileType = this.profileType + "_inverted";
    }

    if (profile == 'linear') {
        this.cycle = 0;
        this.luminanceArms = 1;
        this.profile.length = 2;
        this.profile[0] = invert ? 1.0 : 0.0;
        this.profile[1] = invert ? 0.0 : 1.0;
        this.linear = true;

    }
    else if (profile == 'diverging') {
        this.cycle = 1;
        this.luminanceArms = 2;
        this.profile.length = 3;
        this.profile[0] = invert ? 1.0 : 0.0;
        this.profile[1] = invert ? 0.0 : 1.0;
        this.profile[2] = invert ? 1.0 : 0.0;
        this.diverging = true;
    }
    else if (profile == 'wave') {
        this.cycle = 1.5;
        this.luminanceArms = 3;
        this.profile.length = 4;
        this.profile[0] = invert ? 1.0 : 0.0;
        this.profile[1] = invert ? 0.0 : 1.0;
        this.profile[2] = invert ? 1.0 : 0.0;
        this.profile[3] = invert ? 0.0 : 1.0;
        this.wave = true;
    }
    this.invert = invert;
}

LuminanceProfile.prototype.generateProfileImage = function(w, h)
{
    var PSTEP=1;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    var ctx = canvas.getContext('2d');
    ctx.lineWidth = PSTEP;

    for (var x=0; x<w; x += PSTEP)
    {
        var l = this.getLuminance(x/(w-1));
        var nL = (l-LRANGE[0]) / (LRANGE[1]-LRANGE[0]);
        var hL = Math.floor(h*nL+.5);
        hL = h;
        var color = d3.rgb(d3.lab(nL*100, 0, 0)).toString();
        ctx.strokeStyle = color;
        ctx.beginPath()
        ctx.moveTo(x, h-hL);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    return canvas;
}

LuminanceProfile.prototype.getConfusionPairs = function(keys)
{
    var CONFUSION_LUM_DIFF = 15;
    var expBase = 10;

    function confusionLikelihood(base, armDiff)
    {
        var f = Math.pow(base, Math.abs(1-armDiff)) - 1;
        return f / (base-1);
    }

    if (CACHED_PAIRS[this.profileType + "_" + keys]) {
        return CACHED_PAIRS[this.profileType + "_" + keys];
    }

    var confusionPairs = [];

    for (var k1=1; k1<keys; k1++)
    {
        var k1Norm = k1/(keys-.999999999);
        var k1Arm = Math.floor( k1Norm * this.luminanceArms );
        var k1ArmPos = (k1Norm * this.luminanceArms) % 1;

        for (var k2=0; k2<k1; k2++)
        {
            var k2Norm = k2/(keys-.999999999);
            var k2Arm = Math.floor( k2Norm * this.luminanceArms );
            var k2ArmPos = (k2Norm * this.luminanceArms) % 1;

            // difference in luminance
            var lumDiff = Math.abs(this.getLuminance(k1Norm) - this.getLuminance(k2Norm));

            if (k1Arm != k2Arm && lumDiff < CONFUSION_LUM_DIFF)
            {
                // compute strength of confusion as a function
                // of the distance between the two keys within-arm positions
                var armDiff = Math.abs(k1ArmPos-k2ArmPos);
                var likelihood = confusionLikelihood(expBase, armDiff)

                // add as potential confusion pairs
                confusionPairs.push({
                    a1: k1Arm,
                    a2: k2Arm,
                    k1: k1,
                    k2: k2,
                    likelihood: likelihood,
                    n1: k1Norm,
                    n2: k2Norm,
                    lumDiff: lumDiff
                });
            }
        }
    }

    CACHED_PAIRS[this.profileType + "_" + keys] = confusionPairs;
    return confusionPairs;
}
LuminanceProfile.prototype.isDiverging = function()
{
    return this.diverging === true;
}

LuminanceProfile.prototype.isWave = function()
{
    return this.wave === true;
}

LuminanceProfile.prototype.getConfusionMap = function(keys)
{
    if (CACHED_MAPS[this.profileType + "_" + keys]) {
        return CACHED_MAPS[this.profileType + "_" + keys];
    }

    var confusionMap = [];
    for (var i=0; i<keys; i++) {
        confusionMap.push([]);
    }
    var pairList = this.getConfusionPairs(keys);
    for (var i=0, len=pairList.length; i<len; i++) {
        var p = pairList[i];
        confusionMap[p.k1].push({
            confuser: p.k2,
            likelihood: p.likelihood,
            lumDiff: p.lumDiff
        });

        confusionMap[p.k2].push({
            confuser: p.k1,
            likelihood: p.likelihood,
            lumDiff: p.lumDiff
        });
    }

    // store cache
    CACHED_MAPS[this.profileType + "_" + keys] = confusionMap;
    return confusionMap;
}

LuminanceProfile.prototype.getProfileType = function() {
    return this.profileType;
}

LuminanceProfile.prototype.getLuminance = function(alpha)
{
    // alpha should be between 0 and 1
    var a = alpha * (this.profile.length-1);
    var i1 = Math.floor(a);
    var i2 = Math.ceil(a);
    var c1 = this.profile[i1];
    var c2 = this.profile[i2];

    var b = a-i1;
    var L = b * (c2-c1) + c1;

    return L * (LRANGE[1]-LRANGE[0]) + LRANGE[0];
}
LuminanceProfile.prototype.getKeyMultiples = function(_desiredKeys)
{
    var keyCount = _desiredKeys || DESIRED_KEYS;

    // figure out how many luinance segments do we have
    var segments = this.profile.length-1;

    // subtract luminane control points from key count
    var remaining = keyCount - this.profile.length;

    // are the remaining key counts devisible by the number of segments?
    keyCount += remaining % segments;

    // make sure the number of keys is a multiple of profile.length
    // this ensures that important luminance control points (e.g., peaks)
    // get their own key
    /*
    var modulo = (keyCount % this.profile.length);
    if (modulo != 0) {
        keyCount += this.profile.length - (keyCount % this.profile.length);
    }
    */
    KEYS = keyCount;

    return keyCount;
}
