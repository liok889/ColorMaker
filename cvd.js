var CVD_MATRIX = {
    protanomaly_05: [
        [0.458064,	0.679578,	-0.137642],
        [0.092785,	0.846313,	0.060902],
        [-0.007494,	-0.016807,	1.024301]
    ],
    protanomaly_07: [
        [0.319627,	0.849633,	-0.169261],
        [0.106241,	0.815969,	0.077790],
        [-0.007025,	-0.028051,	1.035076],
    ],

    protanomaly_08: [
        [0.259411,	0.923008,	-0.182420],
        [0.110296,	0.804340,	0.085364],
        [-0.006276,	-0.034346,	1.040622]
    ],

    tritanomaly_08: [
        [1.257728,	-0.139648,	-0.118081],
        [-0.078003,	0.975409,	0.102594],
        [-0.003316,	0.501214,	0.502102]
    ],

    deuteranomaly_01: [
        [0.866435,	0.177704,	-0.044139],
        [0.049567,	0.939063,	0.011370],
        [-0.003453,	0.007233,	0.996220]
    ],

    deuteranomaly_07: [
        [0.457771,	0.731899,	-0.189670],
        [0.226409,	0.731012,	0.042579],
        [-0.011595,	0.034333,	0.977261]
    ],

    deuteranomaly_09: [
        [0.422823,	0.781057,	-0.203881],
        [0.245752,	0.709602,	0.044646],
        [-0.011843,	0.037423,	0.974421]
    ],

    deuteranomaly_10: [
        [0.367322,	0.860646,	-0.227968],
        [0.280085,	0.672501,	0.047413],
        [-0.011820,	0.042940,	0.968881]
    ]
};
CVD_MATRIX.protanomaly = CVD_MATRIX.protanomaly_08;
CVD_MATRIX.deuteranomaly = CVD_MATRIX.deuteranomaly_07;
CVD_MATRIX.tritanomaly = CVD_MATRIX.tritanomaly_08;

function inRange(curR, maxR) {
    if (maxR > 0) {
        return curR <= maxR;
    } else {
        return curR >= maxR;
    }
}

function inRange2(curR, range)
{
    var minR = range[0];
    var maxR = range[1];
    if (maxR > minR) {
        return curR >= minR && curR <= maxR;
    }
    else {
        return curR >= maxR && curR <= minR;
    }
}

function ColorTransform(mat, matMath)
{
    this.matrix = mat;
    /*
    if (matMath) {
        this.projection = math.matrix(mat);
        this.inverse = math.inv(this.projection);
    }
    */
}

/*
ColorTransform.prototype.deTransformLAB = function(labColor)
{
    var rgbColor = d3.rgb(labColor);
    var tRGB = this.deTransformRGB(rgbColor);
    return d3.lab(tRGB);
}
*/

ColorTransform.prototype.transformLAB = function(labColor)
{
    var rgbColor = d3.rgb(labColor);
    var tRGB = this.transformRGB(rgbColor);
    return d3.lab(tRGB);
}

ColorTransform.prototype.transformRGB = function(rgbColor)
{
    var m = this.matrix;
    var v = [
        m[0][0]*rgbColor.r + m[0][1]*rgbColor.g + m[0][2]*rgbColor.b,
        m[1][0]*rgbColor.r + m[1][1]*rgbColor.g + m[1][2]*rgbColor.b,
        m[2][0]*rgbColor.r + m[2][1]*rgbColor.g + m[2][2]*rgbColor.b,
    ];
    return d3.rgb(v[0], v[1], v[2]);

    /*
    var v = math.multiply(this.projection, [rgbColor.r, rgbColor.g, rgbColor.b]);
    return d3.rgb(v._data[0], v._data[1], v._data[2]);
    */
}

/*
ColorTransform.prototype.deTransformRGB = function(rgbColor)
{
    var v = math.multiply(this.inverse, [rgbColor.r, rgbColor.g, rgbColor.b]);
    return d3.rgb(v._data[0], v._data[1], v._data[2]);
}
*/

function channelIndex(v, range, slices)
{
    var n = (v-range[0]) / (range[1]-range[0]);
    var i = Math.floor(.5+n * slices);
    return i;
}

ColorTransform.prototype.lookupLAB = function(labColor)
{
    var iL = channelIndex(labColor.l, this.lRange, this.lSlices);
    var iA = channelIndex(labColor.a, this.aRange, this.aSlices);
    var iB = channelIndex(labColor.b, this.bRange, this.bSlices);

    return this.trimmedLAB[iL][iA][iB];
}

ColorTransform.prototype.getLRange = function() {
    return this.lRange;
}
ColorTransform.prototype.getARange = function(l) {
    var iL = channelIndex(l, this.lRange, this.lSlices);
    var lSlice = this.trimmedLAB[iL];
    return [
        lSlice.minA, lSlice.maxA
    ];
}


ColorTransform.prototype.colorInModel = function(labColor)
{
    if (!inRange2(labColor.l, this.lRange)) {
        return null;
    }

    var iL = channelIndex(labColor.l, this.lRange, this.lSlices);
    var lSlice = this.trimmedLAB[iL];

    if (lSlice.countDisplayable == 0 || !inRange2(labColor.a, [lSlice.minA, lSlice.maxA])) {
        return null;
    }

    var iA = channelIndex(labColor.a, this.aRange, this.aSlices);
    var aSlice = lSlice[iA];

    if (aSlice.countDisplayable == 0 || !inRange2(labColor.b, [aSlice.minB, aSlice.maxB]))
    {
        return null;
    }
    //console.log("a: " + lSlice.minA.toFixed(3) + " -- "  + lSlice.maxA.toFixed(3) + ', b: ' + aSlice.minB.toFixed(3) + " -- " + aSlice.maxB.toFixed(3)  )

    var iB = channelIndex(labColor.b, this.bRange, this.bSlices);
    return aSlice[iB];

    /*
    return this.trimmedLAB
        [channelIndex(labColor.l, this.lRange, this.lSlices)]
        [channelIndex(labColor.a, this.aRange, this.aSlices)]
        [channelIndex(labColor.b, this.bRange, this.bSlices)];
    */
}

ColorTransform.prototype.computeTrimmedLab = function()
{
    var L_SLICES = 100;
    var AB_SLICES = 100;

    var projection = this.projection;

    var lRange = LAB_RANGE[0].range;
    var aRange = LAB_RANGE[1].range;
    var bRange = LAB_RANGE[2].range;

    var lStep = (lRange[1]-lRange[0]) / L_SLICES;
    var aStep = (aRange[1]-aRange[0]) / AB_SLICES;
    var bStep = (bRange[1]-bRange[0]) / AB_SLICES;

    this.lRange = lRange;
    this.aRange = aRange;
    this.bRange = bRange;
    this.lSlices = L_SLICES;
    this.bSlices = AB_SLICES;
    this.aSlices = AB_SLICES;


    var lSlices = [];
    for (var L=lRange[0], maxL = lRange[1]; L<=maxL; L+= lStep)
    {
        var lSlice = [];
        lSlices.push(lSlice);

        lSlice.minA = Number.MAX_VALUE;
        lSlice.maxA = -Number.MAX_VALUE;
        lSlice.countDisplayable = 0;

        for (var a=aRange[0], maxA = aRange[1]; inRange(a, maxA); a += aStep)
        {
            var aSlice = [];
            lSlice.push(aSlice);
            aSlice.minB = Number.MAX_VALUE;
            aSlice.maxB = -Number.MAX_VALUE;


            aSlice.countDisplayable = 0;
            for (var bIndex=0, b=bRange[0], maxB=bRange[1]; inRange(b, maxB); b += bStep, bIndex++)
            {
                var labColor = d3.lab(L, a, b);
                if (labColor.displayable())
                {
                    // convert lab to RGB, project it, and convert back to LAB
                    var rgbColor = d3.rgb(labColor);
                    var tRGB = this.transformRGB([rgbColor.r, rgbColor.g, rgbColor.b]);
                    var cRGB = d3.rgb(tRGB.r, tRGB.g, tRGB.b);
                    var tLAB = d3.lab(cRGB);

                    aSlice.push(tLAB);
                    aSlice.minB = Math.min(aSlice.minB, tLAB.b);
                    aSlice.maxB = Math.max(aSlice.maxB, tLAB.b);
                    aSlice.countDisplayable++;

                    lSlice.minA = Math.min(lSlice.minA, tLAB.a);
                    lSlice.maxA = Math.max(lSlice.maxA, tLAB.a);
                    lSlice.countDisplayable++;

                }
                else {
                    aSlice.push(null);
                }
            }
        }
    }
    this.trimmedLAB = lSlices;
}

var cvdColorspace = null;
function buildCVD(modelName)
{
    if (cvdColorspace && modelName == cvdColorspace.modelName) {
        return cvdColorspace;
    }
    else {
        if (!modelName) {
            modelName = 'deuteranomaly_09';
        }
        cvdColorspace = new ColorTransform(CVD_MATRIX[modelName]);
        //cvdColorspace.computeTrimmedLab();
        cvdColorspace.modelName = modelName;
        return cvdColorspace;
    }
}
function clearCVD() {
    cvdColorspace = null;
}

function getCVDModel() {
    return cvdColorspace;
}

function cvdSimulation(colormap, modelName)
{
    var model;
    if (modelName) {
        model = new ColorTransform(CVD_MATRIX[modelName])
    }
    else {
        var model = getCVDModel(); //buildCVD(modelName);
        if (!model) {
            return null;
        }
    }

    if (!colormap) {
        colormap = opt.getColorMap();
    }
    var newKeys = [];

    for (var i=0, len=50; i<=len; i++)
    {
        var c = colormap.mapValue(i/len);
        var t = model.transformRGB(c);
        // var t2 = d3.rgb(model.lookupLAB(d3.lab(c)));

        newKeys.push({
            value: i/len,
            rgb: [t.r, t.g, t.b]
        });
    }

    var newColormap = new ColorMap(newKeys);
    return newColormap;
    //colormapToImage(newColormap, d3.select("#colormapImage"));
}


//buildCVD('deuteranomaly_09');

function deTransform()
{
    var colormap = opt.getColorMap();
    var newColorset = [];
    var cvdModel = getCVDModel();

    for (var i=0, len=50; i<len; i++)
    {
        var value = i/(len-1);
        var c = colormap.mapValue(value);
        var l = d3.lab(c);
        var tL = cvdModel.deTransformLAB(l);
        var t = d3.rgb(d3.lab(value*(95-5)+5, tL.a, tL.b));
        //var t = cvdModel.deTransformRGB(c);
        console.log('in: ' + c.r.toFixed(1) + ', ' + c.g.toFixed(1) + ', ' + c.b.toFixed(1) + " - out: "+ t.r.toFixed(1) + ', ' + t.g.toFixed(1) + ', ' + t.b.toFixed(1))
        newColorset.push({value: value, rgb: [t.r, t.g, t.b]});
    }
    var newColormap = new ColorMap(newColorset);
    colormapToImage(newColormap, d3.select("#colormapImage"));
}
