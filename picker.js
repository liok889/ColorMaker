function createOffscreenCanvas(w, h)
{
    var offScreenCanvas= document.createElement('canvas');
    offScreenCanvas.width = w;
    offScreenCanvas.height = h;
    return offScreenCanvas;
}

// whether the picker should display CVD-transformed model
var CVD_PICKER = false;

var PICKER_MODE_HSL = 1;
var PICKER_MODE_LAB = 2;

var GRADIENT_PAD = 4*1.5;
var GRADIENT_H = 20*1.5;
var PICKER_STEP=2;

var mDown = null;
var minDistanceAchieved = false;

function Picker(svg, w, h, colorCoord)
{
    this.svg = svg;
    this.w = w;
    this.h = h;
    this.mode = PICKER_MODE_HSL;
    this.callbacks = [];

    // default color
    var DEFAULT_COLOR = d3.lab(d3.rgb('rgb(72, 184, 255)'));
    var defColor = this.getArrayedColor(this.getColorFromLAB(DEFAULT_COLOR));
    var defGradPos = this.revScaleRange(defColor[0], 0);
    var defSlicePos = [
        this.revScaleRange(defColor[1], 1),
        this.revScaleRange(defColor[2], 2),
    ];

    // position the gradient
    this.gradientPos = colorCoord ? colorCoord[0] : defGradPos;
    this.slicePos = colorCoord ? [colorCoord[1], colorCoord[2]] : defSlicePos;

    var pickedColorH = this.h;
    var pickedColorW = this.h;

    var sliceW = this.w - (pickedColorW + GRADIENT_PAD);
    var sliceH = this.h - (GRADIENT_H+GRADIENT_PAD);

    this.imageSlice = this.svg.append('image')
        .attr('x', 0).attr('y', 0)
        .attr('width', sliceW)
        .attr('height', sliceH);

    this.imageGradient = this.svg.append('image')
        .attr('x', 0).attr('y', sliceH + GRADIENT_PAD)
        .attr('width', sliceW).attr('height', GRADIENT_H);

    this.pickedColor = this.svg.append('rect')
        .attr('id', 'selectedColor')
        .attr('x', sliceW + GRADIENT_PAD)
        .attr('y', 0)
        .style('stroke', 'black')
        .style('stroke-width', '1px')
        .attr('width', pickedColorW).attr('height', pickedColorH)
        .on("mouseover", function () { showTooltip("Drag Color below to the Shelf to generate Colormap"); })
        .on("mousemove", updateTooltip).on("mouseout", hideTooltip);

    // text to indicate selected color
    this.text = (new ShadowedText(this.svg))
        .setX(sliceW + 4 + GRADIENT_PAD+1)
        .setY(90*1.5-20)
        .attr('class', 'smallText selectedText');
    /*

    this.svg.append('text')
        .attr('x', sliceW + 4 + GRADIENT_PAD+1)
        .attr('y', 90*1.5-20)
        .attr('class', 'smallText selectedText')
        .style('fill', 'white')
    this.svg.append('text')
        .attr('class', 'smallText selectedText')
        .attr('x', sliceW + 4 + GRADIENT_PAD+1-.5)
        .attr('y', 90*1.5-20-.5)
        .style('fill', 'black');
    */


    this.selectorG = this.svg.append('g');

    this.selectorG.append('circle')
        .attr('class', 'selectIndicator')
        .attr('id', 'gradientSelector2')
        .attr('r', 4*1.5)
        .attr('cy', sliceH + GRADIENT_PAD + GRADIENT_H/2+1)
        .attr('cx', this.gradientPos * sliceW+1)
        .style('fill', 'none')
        .style('stroke', 'white')

    this.selectorG.append('circle')
        .attr('class', 'selectIndicator')
        .attr('id', 'gradientSelector1')
        .attr('r', 4*1.5)
        .attr('cy', sliceH + GRADIENT_PAD + GRADIENT_H/2)
        .attr('cx', this.gradientPos * sliceW)
        .style('fill', 'none')
        .style('stroke', 'black')

        this.selectorG.append('circle')
            .attr('class', 'selectIndicator')
            .attr('id', 'sliceSelector2')
            .attr('r', 4*1.5)
            .attr('cy', this.slicePos[1] * sliceH+1)
            .attr('cx', this.slicePos[0] * sliceW+1)
            .style('fill', 'none')
            .style('stroke', 'white')

    this.selectorG.append('circle')
        .attr('class', 'selectIndicator')
        .attr('id', 'sliceSelector1')
        .attr('r', 4*1.5)
        .attr('cy', this.slicePos[1] * sliceH)
        .attr('cx', this.slicePos[0] * sliceW)
        .style('fill', 'none')
        .style('stroke', 'black')


    this.renderGradient();
    this.renderSlice();
    this.updateColor();
    this.lastSliceRender = undefined;
    (function(obj)
    {
        var gradFunc = function(x) {
            obj.adjustGradientPos(x);
        }
        var sliceFunc = function(x, y) {
            obj.adjustSlicePos([x, y]);
        }
        addMMCallback(obj.imageGradient, null, gradFunc, gradFunc);
        addMMCallback(obj.imageSlice, null, sliceFunc, sliceFunc);

    })(this);
}
Picker.prototype.dispose = function() {
    this.svg.selectAll("*").remove();
}

Picker.prototype.addCallback = function(callback) {
    this.callbacks.push(callback);
}

Picker.prototype.updateColor = function(labColor)
{
    var labColor = this.getLABColor();
    this.pickedColor
        .style('fill', this.getColor().toString());

    const valCol = Object.values(this.getColor());
    const keyCol = Object.keys(this.getColor());
    let colorText = (keyCol[0] + keyCol[1] + keyCol[2]).toUpperCase() +
    " (" +
    parseInt(valCol[0]) + ', ' + parseInt(valCol[1]) + ', ' + parseInt(valCol[2]) +
    ")";

    if((keyCol[0] + keyCol[1] + keyCol[2]) == 'hsl') {
        colorText = (keyCol[0] + keyCol[1] + keyCol[2]).toUpperCase() +
        " (" +
        parseInt(valCol[0]) + ', ' + parseInt(valCol[1]*100) + ', ' + parseInt(valCol[2]*100) +
        ")";
    }

    // HEX Code
    function colorToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    var rgbColor = d3.rgb(labColor.rgb().toString());
    var hexCode = labColor.formatHex().substr(1);
    //var hexCol = colorToHex(roundInt(rgbColor.r)) + colorToHex(roundInt(rgbColor.g)) + colorToHex(roundInt(rgbColor.b));
    document.getElementById("hexColor").value = hexCode;//rgbColor.formatHex()//hexCol;

    //d3.selectAll(".selectedText")
    //    .text(colorText);
    this.text.setText(colorText);
    if (labColor.l > 60) {
        this.text.lightBackground();
    }
    else {
        this.text.darkBackground();
    }

    for (var i=0; i<this.callbacks.length; i++) {
        this.callbacks(labColor);
    }
}

// change picker after hex input
function isValidHex(hexColor) {
    var hexRegex = /([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(hexColor);
}
function updateColorFromHex(hexColor) {
    if (isValidHex(hexColor)) {
        var rgbColor = d3.rgb("#" + hexColor);
        var labColor = d3.lab(rgbColor);

        // Check if the color is within the gamut
        if (labColor.displayable()) {
            picker.setLABColor(labColor);
            picker.updateColor();
        } else {
            // // If the color is outside the gamut, convert to the closest displayable color
            // var closestDisplayableColor = labColor.clipped();
            // picker.setLABColor(closestDisplayableColor);
            // picker.updateColor();
        }
    } else {
        // If the input is not a valid hex color, keep the current color
    }
}


Picker.prototype.getLABColor = function()
{
    var c = this.getColor();
    var lab = d3.lab(c);
    return lab;
}

Picker.prototype.createColor = function(color) {
    return this.colorConstructor(
        color[this.range[0].key],
        color[this.range[1].key],
        color[this.range[2].key]
    );
}

Picker.prototype.getColor = function()
{
    var one = this.scaleRange(this.gradientPos, 0);
    var two = this.scaleRange(this.slicePos[0], 1);
    var three = this.scaleRange(this.slicePos[1], 2);

    return this.colorConstructor(one, two, three);
}
Picker.prototype.setLABColor = function(labColor)
{
    var theColor = this.colorConstructor(labColor);
    this.gradientPos = this.revScaleRange(theColor[this.range[0].key], 0);
    this.slicePos = [
        this.revScaleRange(theColor[this.range[1].key], 1),
        this.revScaleRange(theColor[this.range[2].key], 2)
    ];
    this.adjustGradientPos(this.gradientPos);
    this.adjustSlicePos(this.slicePos);

    //console.error('not implemented');
    //return null;
}

Picker.prototype.sliceColor = function(one, two, three)
{
    var c = this.colorConstructor(
        this.scaleRange(one, 0),
        this.scaleRange(two, 1),
        this.scaleRange(three, 2)
    );
    return c.toString();
}

Picker.prototype.setRGBColor = function(rgbColor)
{
    rgbColor.r = Math.max(0, Math.min(255, rgbColor.r))
    rgbColor.g = Math.max(0, Math.min(255, rgbColor.g))
    rgbColor.b = Math.max(0, Math.min(255, rgbColor.b))

    var labColor = d3.lab(rgbColor)
    this.setLABColor(labColor);
}
Picker.prototype.getRGBColor = function() {
    return d3.rgb(this.getColor());
}

Picker.prototype.adjustGradientPos = function(newPos)
{
    this.gradientPos = newPos;
    this.renderSlice();
    this.selectorG.select("#gradientSelector1")
        .attr('cx', newPos* (+this.imageGradient.attr('width')))

    this.selectorG.select("#gradientSelector2")
        .attr('cx', newPos* (+this.imageGradient.attr('width')))
    this.updateColor();
}

Picker.prototype.adjustSlicePos = function(newPos)
{
    this.slicePos = newPos;
    this.selectorG.select("#sliceSelector1")
        .attr('cx', newPos[0]* (+this.imageSlice.attr('width')))
        .attr('cy', newPos[1]* (+this.imageSlice.attr('height')))

    this.selectorG.select("#sliceSelector2")
    .attr('cx', 1+newPos[0]* (+this.imageSlice.attr('width')))
    .attr('cy', 1+newPos[1]* (+this.imageSlice.attr('height')))
    this.updateColor();
}


Picker.prototype.gradientColor = function(i)
{
    console.error("unimplemented");
    return null;
}
Picker.prototype.gradientSlice = function(i, j)
{
    console.error("unimplemented");
    return null;
}

Picker.prototype.getColorSpace = function()
{
    console.error("getColorSpace abstract not implemented");
    return null;
}

Picker.prototype.renderGradient = function(image)
{
    var w = +this.imageGradient.attr('width');
    var h = +this.imageGradient.attr('height');
    var canvas =  createOffscreenCanvas(w, h);
    var context = canvas.getContext("2d");

    context.strokeStyle="black";
    for (var i=0; i<w; i+=PICKER_STEP) {
        context.fillStyle = this.gradientColor(i/(w-1));
        context.fillRect(i, 0, PICKER_STEP, h);
    }
    this.imageGradient.attr("xlink:href", canvas.toDataURL());
}

Picker.prototype.actualSliceRender = function()
{
    var w = +this.imageSlice.attr('width');
    var h = +this.imageSlice.attr('height');
    var canvas =  createOffscreenCanvas(w, h);
    var context = canvas.getContext("2d");

    for (var j=0; j<h; j+= PICKER_STEP)
    {
        var r = j/(h-1);
        for (var i=0; i<w; i+= PICKER_STEP)
        {
            var c = i/(w-1);
            context.fillStyle = this.sliceColor(this.gradientPos, c, r);
            context.fillRect(i, j, PICKER_STEP, PICKER_STEP);
        }
    }
    this.imageSlice.attr("xlink:href", canvas.toDataURL());
    this.lastSliceRender = Date.now();
}

Picker.prototype.renderSlice = function(slice)
{
    function scheduleRender(obj, timeToRender) {
        if (obj.renderCall !== undefined) {
            clearTimeout(obj.renderCall);
        }
        obj.renderCall = setTimeout(function() {
            obj.actualSliceRender();
        }, timeToRender)
    }
    var UPDATE_SLICE_EVERY = 30;    // mili seconds


    if (this.lastSliceRender !== undefined)
    {
        var elapsed = Date.now() - this.lastSliceRender;
        if (elapsed < UPDATE_SLICE_EVERY) {
            scheduleRender(this, UPDATE_SLICE_EVERY-elapsed);
            return;
        }
    }
    this.actualSliceRender();
}
Picker.prototype.getRange = function()
{
    return this.range;
}

Picker.prototype.render = function()
{
}

Picker.prototype.setRange = function(range) {
    this.range = range;
}
Picker.prototype.scaleRange = function(norm, index) {
    var range = this.range[index].range;
    return norm * (range[1]-range[0]) + range[0];
}
Picker.prototype.revScaleRange = function(value, index) {
    var range = this.range[index].range;
    return (value - range[0]) / (range[1]-range[0]);
}
Picker.prototype.getArrayedColor = function(c)
{
    var key1 = this.range[0].key;
    var key2 = this.range[1].key;
    var key3 = this.range[2].key;
    return [
        c[key1], c[key2], c[key3]
    ];
}

Picker.prototype.getColorFromSolution = function(arrayedColor)
{
    var labColor = d3.lab(
        arrayedColor[0],
        arrayedColor[1],
        arrayedColor[2]
    );
    return this.getColorFromLAB(labColor);
}
Picker.prototype.getColorFromLAB = function(labColor)
{
    return this.colorConstructor(labColor);
}

/* HSL Picker
 * ----------
 */

var HSL_RANGE = [
    {key: 'h', range: [0, 360], name: "Hue", autoControl: false},
    {key: 's', range: [0, 1], name: "Saturation", autoControl: false},
    {key: 'l', range: [0, 1], name: "Luminance", autoControl: true}
];
function PickerHSL(svg, w, h)
{
    this.colorConstructor = d3.hsl;
    this.setRange(HSL_RANGE);
    Picker.call(this, svg, w, h);
}
PickerHSL.prototype = Object.create(Picker.prototype);

PickerHSL.prototype.getColorSpace = function() {
    return "HSL";
}

PickerHSL.prototype.gradientColor = function(h)
{
    var _h = this.scaleRange(h, 0);
    var c = d3.hsl(_h, 1, 0.5);
    return c.toString();
}


/* RGB Picker
 * -----------
 */

 var RGB_RANGE = [
     {key: 'r', range: [0, 255], name: "Red", autoControl: false},
     {key: 'g', range: [0, 255], name: "Green", autoControl: false},
     {key: 'b', range: [0, 255], name: "Blue", autoControl: false}
 ];
 function PickerRGB(svg, w, h)
 {
     this.colorConstructor = d3.rgb;
     this.setRange(RGB_RANGE);
     Picker.call(this, svg, w, h);
 }
 PickerRGB.prototype = Object.create(Picker.prototype);


 PickerRGB.prototype.getColorSpace = function() {
     return "RGB";
 }

 PickerRGB.prototype.gradientColor = function(r)
 {
     var _r = this.scaleRange(r, 0);
     var c = d3.rgb(_r, 0, 0);
     return c.toString();
 }

/* LCH Picker
 * ----------
 */
 var HCL_RANGE = [
     {key: 'h', range: [-180, 180], name: "Hue", autoControl: false},
     {key: 'c', range: [0.1, 135], name: "Chroma", autoControl: false},
     {key: 'l', range: [0, 100], name: "Luminance", autoControl: true}
 ];
 function PickerHCL(svg, w, h)
 {
     this.colorSpaceName = "HCL";
     this.colorConstructor = d3.hcl;
     this.setRange(HCL_RANGE);
     this.range[0].range = [0, 360];
     Picker.call(this, svg, w, h);
 }
 PickerHCL.prototype = Object.create(Picker.prototype);


 PickerHCL.prototype.getColorSpace = function() {
     return "HCL";
 }

 PickerHCL.prototype.gradientColor = function(h)
 {
     var _h = this.scaleRange(h, 0);
     var c = d3.hcl(_h, 100, 55);
     return c.toString();
 }

 PickerHCL.prototype.sliceColor = function(h, c, l)
 {
     var _h = this.scaleRange(h, 0);
     var c = d3.hcl(_h, this.scaleRange(c, 1), this.scaleRange(l, 2));
     if (!c.displayable())
     {
         return 'rgb(255, 255, 255, 0)';
     } else {
        return c.toString();
    }
 }

 /* LAB Picker
  * ----------
  */

var LAB_RANGE = [
    {key: 'l', range: [0, 100], name: "Luminance", autoControl: true, slices: 100},
    {key: 'a', range: [-110, 110], name: 'Green - Red', slices: 200},
    {key: 'b', range: [110, -110], name: 'Yellow - Blue'}
];
function PickerLAB(svg, w, h)
{
    this.colorSpaceName = "LAB";
    this.colorConstructor = d3.lab;
    this.setRange(LAB_RANGE);
    Picker.call(this, svg, w, h, [.5, .5, .5]);
}
PickerLAB.prototype = Object.create(Picker.prototype);

PickerLAB.prototype.getColorSpace = function() {
    return "LAB";
}

PickerLAB.prototype.gradientColor = function(l)
{
    var c = d3.lab(this.scaleRange(l, 0), 0, 0);
    return c.toString();
}


PickerLAB.prototype.sliceColor = function(l, a, b)
{
    var _l = this.scaleRange(l, 0);
    var _a = this.scaleRange(a, 1);
    var _b = this.scaleRange(b, 2);

    var c = d3.lab(_l, _a, _b);
    if (c.displayable())
    {
        if (CVD_PICKER)
        {
            var cvdModel = getCVDModel()
            if (cvdModel.colorInModel(c)) {
                var cvdColor = cvdModel.transformLAB(c).toString();
                return cvdColor.toString();
            }
            else {
                return "rgb(255, 255, 255, 0)";
            }

        }
        else {
            return c.toString();
        }
    }
    else {
        //return trimColorToGamut(c).toString();
        //return c.toString();
        return "rgb(255, 255, 255, 0)";
    }
}

/* JAB color space CAM02 */
var JAB_RANGE =
[
    {key: 'J', range: [0, 100],  name: 'Luminance', autoControl: true},
    {key: 'a', range: [-45, 45], name: 'Green - Red'},
    {key: 'b', range: [45, -45], name: 'Yellow - Blue'}
];

function PickerJAB(svg, w, h)
{
    this.colorSpaceName = "JAB";
    this.colorConstructor = d3.jab;
    this.setRange(JAB_RANGE);
    Picker.call(this, svg, w, h, [.5, .5, .5]);
}
PickerJAB.prototype = Object.create(Picker.prototype);

/*
PickerJAB.prototype.createColor = function(color) {
    return d3.jab(color.J, color.a, color.b);
}
*/

PickerJAB.prototype.getColorSpace = function() {
    return "JAB";
}
PickerJAB.prototype.gradientColor = function(l)
{
    var _l = this.scaleRange(l, 0);
    var c = d3.jab(_l, 0, 0);
    return c.toString();
}

PickerJAB.prototype.sliceColor = function(l, a, b)
{
    var c = this.getColor(l, a, b);
    if (c.displayable()) {
        return c.toString();
    }
    else {
        //return c.toString();
        return "rgb(255, 255, 255, 0)";
    }
}

PickerJAB.prototype.getColor = function(l, a, b)
{

    var lRange = JAB_RANGE[0].range;
    var aRange = JAB_RANGE[1].range;
    var bRange = JAB_RANGE[2].range;

    var _l = this.scaleRange(l !== undefined ? l : this.gradientPos, 0);
    var _a = this.scaleRange(a !== undefined ? a : this.slicePos[0], 1);
    var _b = this.scaleRange(b !== undefined ? b : this.slicePos[1], 2);

    return d3.jab(_l, _a, _b);
}


PickerJAB.prototype.getColorFromSolution = function(arrayedColor) {
    var labColor = d3.lab(arrayedColor[0], arrayedColor[1], arrayedColor[2]);

    // HACK: JAB has a problem with some colors being 0 Luminance
    if (labColor.l==0) {
        labColor.l = 0.1;
    }
    return d3.jab(labColor)
}
