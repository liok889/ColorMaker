// normal distribution
function gaussian(x, mu, sigma)
{
    const TWO_PI_SQRT = Math.sqrt(2 * Math.PI);

    var sigma2 = sigma*sigma;
    var e = Math.exp(-.5 * Math.pow(x - mu, 2) / sigma2);
    return e / (sigma * TWO_PI_SQRT);
}

var MAX_HARD_KEYS = 4;
var HIGH_IMPORTANCE = 1.0;
var SERIAL = 0;
var MAX_PREF_STRENGTH = gaussian(0, 0, MIN_BLOCK_SIZE*2);

/* ColorPreference: implements a color block that indicates user preference for a
 * particular colors
 */
function ColorPreference(start, end, color)
{
    this.update(start, end)
    this.color = color;
    this.serial = SERIAL++;
}

ColorPreference.prototype.update = function(start, end) {
    this.start = start;
    this.end = end;
    this.mu = .5 * (this.start + this.end);
    this.sigma = .5 * (this.end-this.start);
}

ColorPreference.prototype.copy = function() {
    var copy = new ColorPreference(this.start, this.end, this.color);
    copy.update(this.start, this.end);
    return copy;

}

ColorPreference.prototype.evaluateStrength = function(keyI)
{
    return gaussian(keyI, this.mu, this.sigma);
}
ColorPreference.prototype.getMaxStrength = function()
{
    return gaussian(0, 0, this.sigma);
}
ColorPreference.prototype.evaluateRelStrength = function(keyI)
{
    return this.evaluateStrength(keyI) / MAX_PREF_STRENGTH;
}
ColorPreference.prototype.testIntersection = function(colorBlock)
{
    function intersect(b1, b2)
    {
        var s = b1.start, e = b1.end;
        var intersectionBool = (b2.start >= s && b2.start <= e) || (b2.end >= s && b2.end <= e);
        return intersectionBool;
    }
    return intersect(this, colorBlock) || intersect(colorBlock, this);
}


ColorPreference.prototype.renderGradient = function(width, height, totalWidth)
{
    var GRAD_STEP = 1;

    // luminance profile
    var luminanceGenerator = getLuminanceProfile();

    // create offscreen canvas
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext('2d');

    // get original color
    var color = d3.lab(this.color);

    // loop through pixels
    for (var pixel=0; pixel<width; pixel+= GRAD_STEP)
    {
        var keyI = (pixel/width) * (this.end-this.start) + this.start;
        color.l = luminanceGenerator.getLuminance( keyI );

        // render checker background
        /*
        {
            var CHECKER_SIZE = 8;
            var col = Math.floor(keyI * totalWidth);
            for (var row=0; row<height; row+= GRAD_STEP)
            {
                var indexR = (row / CHECKER_SIZE) % 2;
                var index = ((indexR >= 1 ? col+CHECKER_SIZE : col) / CHECKER_SIZE) % 2;
                if (index >= 1) {
                    context.fillStyle = "rgb(200, 200, 200)";
                    context.fillRect(pixel, row, GRAD_STEP, GRAD_STEP);
                }
            }
        }
        */

        color.opacity = Math.max(1.0, 1.5*this.evaluateRelStrength(keyI));
        if (color.displayable())
        {
            context.fillStyle = color.toString();
            context.fillRect(pixel, 0, GRAD_STEP, height);
        }
        else {
            var trimmedColor = trimColorToGamut(color);
            trimmedColor.opacity = color.opacity;
            context.fillStyle = trimmedColor.toString();
            context.fillRect(pixel, 0, GRAD_STEP, height);
        }
    }
    return canvas;


}

/* UserModel: implements user preference */
function UserModel(prefColorBlocks)
{
    this.hardKeys = [];
    this.updateBiasVectors(prefColorBlocks)
}

UserModel.prototype.updateBiasVectors = function(prefColorBlocks)
{
    if (!prefColorBlocks) {
        // empty preference blocks
        prefColorBlocks = [];
    }

    var bias = [];

    // for all keys
    var keyCount = getLuminanceProfile().getKeyMultiples();
    for (var i=0; i<keyCount; i++)
    {
        // look through all colors
        var keyI = i/(keyCount-1);
        var biasForKey = [];

        for (var j=0, len=prefColorBlocks.length; j<len; j++)
        {
            var prefBlock = prefColorBlocks[j];
            var mu = (prefBlock.start + prefBlock.end)/2;
            var sigma = (prefBlock.end-prefBlock.start)/2;

            // evaluate a gaussian centered at the middle of the block
            var h = gaussian(keyI, mu, sigma);
            var maxH = gaussian(0, 0, sigma);

            // create pref color
            var prefColor = [prefBlock.color.l, prefBlock.color.a, prefBlock.color.b];

            // accumilate the contribution of the color weighted by the gaussian
            biasForKey.push({
                /*
                strength: h,
                maxHeight: maxH,
                */
                relativeStrength: prefBlock.evaluateRelStrength(keyI),
                preference: prefColor
            });
        }

        bias.push(biasForKey);
    }
    this.bias = bias;
}

UserModel.prototype.test = function()
{
    console.log("test function")
}

UserModel.prototype.getBias = function()
{
    var biasCopy = [];
    for (var i=0, len=this.bias.length; i<len; i++)
    {
        biasCopy.push(this.bias[i].slice());
    }

    // add in hard keys
    for (var i=0, len=this.hardKeys.length; i<len; i++)
    {
        var hardKey = this.hardKeys[i];
        biasCopy[hardKey.index].push({
            relativeStrength: MAX_PREF_STRENGTH * hardKey.importance,
            preference: hardKey.color
        });
    }

    return biasCopy;
}

UserModel.prototype.addHardKey = function(keyIndex, color)
{
    // see if key index is already there
    for (var i=0; i<this.hardKeys.length; i++)
    {
        var k = this.hardKeys[i];
        if (k.index == keyIndex)
        {
            this.hardKeys.splice(i, 1);
        }
    }

    // add key at the end
    this.hardKeys.push({
        importance: 1,
        index: keyIndex,
        color: color
    });

    // remove element if exceeding maximum allowed
    if (this.hardKeys.length > MAX_HARD_KEYS) {
        this.hardKeys.shift();
    }

    // re-evaluate importance
    for (var i=0, lastIndex = this.hardKeys.length-1; i<=lastIndex; i++) {
        var importance = Math.exp(-.6 * (lastIndex-i));
        this.hardKeys[i].importance = importance;
    }
}
