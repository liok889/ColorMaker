// Data generators: make up sample scalar field from random noise
function DataGenerator(field)
{

    this.field = field;
    this.data = field.view;
}
DataGenerator.prototype.generate = function(param) {
    console.error("DataGenerator abstract not implemented");
}

function TerrainGenerator(field)
{
    // note: terratin generator assumes w=h
    DataGenerator.call(this, field);
    this.terrainGen = new Terrain(Math.log2(field.w-1), this.data);
}
TerrainGenerator.prototype = Object.create(DataGenerator)
TerrainGenerator.prototype.generate = function(param)
{
    this.terrainGen.generate(.5);
}

function NoiseGenerator(field, noiseScale)
{
    DataGenerator.call(this, field);
    this.noiseScale = noiseScale;
}
NoiseGenerator.prototype = Object.create(DataGenerator)
NoiseGenerator.prototype.generate = function()
{
    seedNoise();
    makeNoise(this.field, this.noiseScale)
}

function SineGenerator(field)
{
    DataGenerator.call(this, field);
    this.noiseScale = noiseScale;
}
SineGenerator.prototype = Object.create(DataGenerator)
SineGenerator.prototype.generate = function()
{
    // how many sine waves to generate?
    var FREQ = 4;
    var field = this.field;
    var data = this.field.view;
    var cycle = Math.min(field.w, field.h) / FREQ;

    for (var I=0, r=0; r<field.h; r++)
    {
        var rCycle = r/cycle
        var impulseRow = Math.sin(rCycle * 2 * Math.PI);
        for (var c=0; c<field.w; c++, I++)
        {
            var cCycle = c/cycle;
            var scale = 1;

            // create a dimple between cycles 2-3
            if (rCycle >= 2 && rCycle <= 3 && cCycle >= 2 && cCycle <= 3) {
                var d = Math.sqrt(Math.pow(rCycle-2.5,2)+Math.pow(cCycle-2.5,2));
                if (d <= .6) {
                    scale = 1-.8 * ((.6-d)/.6);
                }
            }
            var impulseCol = Math.sin(cCycle * 2 * Math.PI);
            data[I] = scale * (impulseRow+impulseCol);

        }
    }
}

function ScalarExamples(canvases)
{
    this.canvases = [];
    this.fields = [];
    this.visualizers = [];
    this.generators = [];
    this.standalone = [];

    for (var i=0; i<canvases.length; i++)
    {
        var canvas = canvases[i];
        var w = canvas.width;
        var h = canvas.height;

        // create scalar field
        var field = new ScalarField(w, h);
        this.fields.push(field);
        this.canvases.push(canvas);

        // create a visualizer pairing the field
        // with the canvas
        var vis = new ScalarVis(field, canvas);
        this.visualizers.push(vis);

        // data generator
        var gen = null;
        switch (i)
        {
        case 0:
            gen = new NoiseGenerator(field, 1);
            break;
        case 1:
            gen = new NoiseGenerator(field, 3);
            break;
        case 2:
            gen = new SineGenerator(field);
            break;
        default:
            gen = new TerrainGenerator(field);
            break;
        }
        this.generators.push(gen);
    }
    this.refresh();
}

ScalarExamples.prototype.addStandalone = function(field, canvas)
{
    // only one at a time for now
    for (var i=0; i<this.standalone.length; i++) {
        this.standalone[i].vis.dispose();
    }
    this.standalone = [];

    var vis = new ScalarVis(field, canvas);
    this.standalone.push({
        vis: vis,
        field: field
    });

    // assign current colormap
    if (opt.getColorMap())
    {
        field.setColorMap(opt.getColorMap());
    }
    vis.vis();
}

ScalarExamples.prototype.refresh = function()
{
    for (var i=0; i<this.generators.length; i++) {
        this.generators[i].generate();
        this.fields[i].normalize();

        // flag that data has been updated
        this.fields[i].updated();
        this.visualizers[i].vis();
    }

    // deal with standalones
    for (var i=0; i<this.standalone.length; i++) {
        //this.standalone[i].field.updated();
        this.standalone[i].vis.vis();
    }
}

ScalarExamples.prototype.setColorMap = function(colormap)
{
    ScalarVis.setUniversalColormap(colormap)
}

// Combine the map modules into a single module
var combinedMapModule = (function() {
    var unemploymentMap1 = d3.map();
    var unemploymentMap2 = d3.map();
    var svg_map1, svg_map2;

    // create the choropleth svg for map1
    function createChoroplethMap1(callback) {
        d3.select('div#map1 svg').remove();

        // load the csv file
        d3.csv("profile/unemployment.csv").then(function(data) {
            data.forEach(function(d) {
                unemploymentMap1.set(d.id, +d.rate);
            });
            // load svg
            d3.xml("profile/mod.svg")
                .then(function(xml) {
                    var importedNode = document.importNode(xml.documentElement, true);
                    svg_map1 = d3.select(importedNode);
                    d3.select('div#map1')
                        .node()
                        .appendChild(svg_map1.node());
                    if (typeof callback === "function") {
                        callback();
                    }
                })
                .catch(function(error) {
                    throw error;
                });
        });
    }

    // create the choropleth svg for map2
    function createChoroplethMap2(callback) {
        d3.select('div#map2 svg').remove();
        // get the svg image
        d3.xml("profile/new.svg")
            .then(function(xml) {
                var importedNode = document.importNode(xml.documentElement, true);
                svg_map2 = d3.select(importedNode);
                d3.select('div#map2')
                    .node()
                    .appendChild(svg_map2.node());
                svg_map2.selectAll("path")
                    .each(function(d, i) {
                        var randomRate;
                        if (i >= 1500) {
                            randomRate = parseFloat(Math.random() * 50);            // random values
                        } else {
                            var rangeSize = 30;
                            var rangeStart = Math.floor(i / rangeSize) * 1;         // start value for each range
                            var rangeEnd = rangeStart + 1;                          // end value for each range
                            randomRate = parseFloat(Math.random() * (rangeEnd - rangeStart) + rangeStart);
                        }
                        unemploymentMap2.set(i, randomRate);
                    });
                    if (typeof callback === "function") {
                        callback();
                    }
            })
            .catch(function(error) {
                throw error;
            });
    }
    // update choropleth w/ colormap for map1
    function updateChoroplethMap1(cmap) {
        var colormapLab = cmap?.colorMap ?? [
            { value: 0, lab: { l: 0, a: 0, b: 0} },
            { value: 1, lab: { l: 100, a: 0, b: 0} }
        ];
        var colormapHex = colormapLab.map(function(color) {
            var labColor = d3.lab(color.lab.l, color.lab.a, color.lab.b);
            return labColor.hex();
        });
        var colorScale = d3.scaleSequential()
                            .domain([Math.min(...Array.from(unemploymentMap1.values())), Math.max(...Array.from(unemploymentMap1.values()))])
                            .interpolator(d3.interpolateRgbBasis(colormapHex));
        var countyID = unemploymentMap1.keys();
        svg_map1.selectAll("path")
            .attr("fill", function(d, i) {
                var rate = unemploymentMap1.get(countyID[i]);
                return rate ? colorScale(rate) : "gray";
            });
    }
    // update choropleth w/ colormap for map2
    function updateChoroplethMap2(cmap) {
        var colormapLab = cmap?.colorMap ?? [
            { value: 0, lab: { l: 0, a: 0, b: 0} },
            { value: 1, lab: { l: 100, a: 0, b: 0} }
        ];
        var colormapHex = colormapLab.map(function(color) {
            var labColor = d3.lab(color.lab.l, color.lab.a, color.lab.b);
            return labColor.hex();
        });
        var colorScale = d3.scaleSequential()
                            .domain([Math.min(...Array.from(unemploymentMap2.values())), Math.max(...Array.from(unemploymentMap2.values()))])
                            .interpolator(d3.interpolateRgbBasis(colormapHex));
        svg_map2.selectAll("path")
            .attr("fill", function(d, i) {
                var rate = unemploymentMap2.get(i);
                return rate ? colorScale(rate) : "gray";
            });
    }
    return {
        createChoroplethMap1: createChoroplethMap1,
        createChoroplethMap2: createChoroplethMap2,
        updateChoroplethMap1: updateChoroplethMap1,
        updateChoroplethMap2: updateChoroplethMap2
    };
})();

// Load Custom Data

// no dimension checking
// async function loadAndDisplayImage(binImgCmap) {
//     binImgFlag = true;
//     const binaryFileInput = document.getElementById('binaryFile');          // getImage
//     const imageWidthInput = document.getElementById('imageWidth');          // getWidth
//     const imageHeightInput = document.getElementById('imageHeight');        // getHeight
//     const imageWidth = parseInt(imageWidthInput.value, 10);
//     const imageHeight = parseInt(imageHeightInput.value, 10);

//     const binaryFilePath = URL.createObjectURL(binaryFileInput.files[0]);   // getPath
//     createBinImage(binaryFilePath, imageWidth, imageHeight, binImgCmap);
//     closePopup();
// }

// dimension checking
/*
async function loadAndDisplayImage(binImgCmap) {
    binImgFlag = true;
    const binaryFileInput = document.getElementById('binaryFile');              // getImage
    const imageWidthInput = document.getElementById('imageWidth');              // getWidth
    const imageHeightInput = document.getElementById('imageHeight');            // getHeight
    const binaryFilePath = URL.createObjectURL(binaryFileInput.files[0]);       // getPath

    try {
        const { width, height } = await getBinaryFileDimensions(binaryFilePath);
        const imageWidth = parseInt(imageWidthInput.value, 10);
        const imageHeight = parseInt(imageHeightInput.value, 10);
        if (imageWidth !== width || imageHeight !== height) {
            // alert(`Error: The correct dimensions for the chosen file are ${width}x${height}.`);
            alert(`Error: Enter the correct dimensions for the chosen file.`);
            return;
        }
        createBinImage(binaryFilePath, imageWidth, imageHeight, binImgCmap);
        closePopup();
    } catch (error) {
        console.error('Error getting binary file dimensions:', error);
    }
}
*/

/*
function createBinImage(filePath, imageWidth, imageHeight, colormap) {
    const canvas = document.getElementById("binimage1-canvas") || document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.id = "binimage1-canvas";
    document.querySelector("div#binimage1").appendChild(canvas);

    loadAndProcessBinarySlice(filePath, imageWidth, imageHeight).then(voxelGridData => {
        const sliceHeight = voxelGridData.length;
        const sliceWidth = voxelGridData[0].length;

        // dimensions for target size
        const targetWidth = 275;
        const targetHeight = 275;

        // scaling based on target
        const scaleX = sliceWidth / targetWidth;
        const scaleY = sliceHeight / targetHeight;
        const scaledWidth = targetWidth;
        const scaledHeight = targetHeight;
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        const imageData = context.createImageData(scaledWidth, scaledHeight);
        const colormapData = new Uint8Array(scaledWidth * scaledHeight * 4);

        // calculate min and max values in the data for cmap
        function findMinMaxValues(voxelGridData) {
            let minDataValue = voxelGridData[0][0];
            let maxDataValue = voxelGridData[0][0];
            for (let i = 0; i < voxelGridData.length; i++) {
                for (let j = 0; j < voxelGridData[i].length; j++) {
                    const value = voxelGridData[i][j];
                    minDataValue = Math.min(minDataValue, value);
                    maxDataValue = Math.max(maxDataValue, value);
                }
            }
            return { minDataValue, maxDataValue };
        }
        const { minDataValue, maxDataValue } = findMinMaxValues(voxelGridData);

        // set cmap
        const colormapHex = colormap ? colormap.colorMap.map(color => d3.lab(color.lab.l, color.lab.a, color.lab.b).hex()) : ['#000000', '#ffffff'];
        const colorScale = d3.scaleSequential()
                            .domain([0, 1])
                            .interpolator(d3.interpolateRgbBasis(colormapHex));
        // loop through data, apply cmap
        for (let y = 0; y < scaledHeight; y++) {
            for (let x = 0; x < scaledWidth; x++) {
                const originalX = Math.floor(x * scaleX);
                const originalY = Math.floor(y * scaleY);
                const value = voxelGridData[originalY][originalX];
                const normalizedValue = (value - minDataValue) / (maxDataValue - minDataValue);
                const colorValue = normalizedValue ? colorScale(normalizedValue) : "#808080"; // Default gray color
                const color = d3.color(colorValue);
                const pixelIndex = (y * scaledWidth + x) * 4;
                colormapData[pixelIndex] = color.r;
                colormapData[pixelIndex + 1] = color.g;
                colormapData[pixelIndex + 2] = color.b;
                colormapData[pixelIndex + 3] = 255;
            }
        }
        imageData.data.set(colormapData);
        context.putImageData(imageData, 0, 0);
    });
}
*/

// fetch and get raw file
async function loadBinaryFile(filePath) {
    const response = await fetch(filePath);
    const buffer = await response.arrayBuffer();
    return new DataView(buffer);
}
/*
// get dimensions of file
async function getBinaryFileDimensions(filePath) {
    const dataView = await loadBinaryFile(filePath);
    const totalDataLength = dataView.byteLength / 2;

    const sqrtTotalDataLength = Math.sqrt(totalDataLength);
    const width = Math.floor(sqrtTotalDataLength);
    const height = Math.ceil(sqrtTotalDataLength);
    return { width, height };
}

async function loadAndProcessBinarySlice(filePath, imageWidth, imageHeight) {
    const dataView = await loadBinaryFile(filePath);
    const sliceWidth = imageWidth;
    const sliceHeight = imageHeight;

    const totalDataLength = dataView.byteLength / 2;
    if (sliceWidth * sliceHeight > totalDataLength) {
        console.error('Insufficient data for the specified image dimensions.');
        return null;
    }
    const voxelGridData = new Array(sliceHeight).fill(null).map(() => new Int16Array(sliceWidth));

    for (let y = 0; y < sliceHeight; y++) {
        for (let x = 0; x < sliceWidth; x++) {
            const index = y * sliceWidth + x;
            voxelGridData[y][x] = dataView.getInt16(index * 2, false);
        }
    }
    return voxelGridData;
}
*/

async function loadAndDisplayImage()
{
    const binaryFileInput = document.getElementById('binaryFile');              // getImage
    if (binaryFileInput.files.length == 0) {
        alert("Please specify a binary scalar file to visualize.");
        return;
    }

    const binaryFilePath = URL.createObjectURL(binaryFileInput.files[0]);       // getPath
    const iW = document.getElementById("imageWidth").value;
    const iH = document.getElementById("imageHeight").value;

    if (iW == '' || iH == '' || isNaN(parseInt(iW)) || isNaN(parseInt(iH)) ) {
        alert("Width and height should be whole numbers.");
        return;
    }

    var w = parseInt(iW);
    var h = parseInt(iH);
    if (w < 0 || h < 0) {
        alert("Width and height should be positive numbers.");
        return;
    }
    var format = document.querySelector('input[name="format"]:checked').value;
    // var format = 'int16';

    var result = await visualizeBinFile(binaryFilePath, w, h, format);
    if (result != 'success')
    {
        alert(result);
    }
    else {
        closePopup();
    }
}

function ImageAccess(canvas)
{
    var ctx = canvas.getContext("2d");
    this.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    this.byteLength = 4 * canvas.width * canvas.height;
}
ImageAccess.prototype.getPixel = function(offset)
{
    var r = this.imageData[offset];
    var g = this.imageData[offset+1];
    var b = this.imageData[offset+2];
    var greyscale = 0.3 * r + 0.59 * g + 0.11 * b;
    return greyscale;
}

var customFileSeq = 1;
async function visualizeBinFile(filePath, w, h, format, littleEndian, emptyData)
{


    if (littleEndian === undefined || littleEndian === null)
    {
        // by default, we assume big endian (which is more common)
        littleEndian = false;
    }

    var dataview;
    var bytesPerPixel = null, accessor = null;

    if (format == 'canvas')
    {
        var canvas = filePath
        dataview = new ImageAccess(canvas);
        bytesPerPixel = 4;
        accessor = dataview.getPixel;
    }
    else {
        dataview = await loadBinaryFile(filePath);


        switch (format)
        {
        case 'int16': bytesPerPixel = 2; accessor = dataview.getInt16; break;
        case 'uint16': bytesPerPixel = 2; accessor = dataview.getUint16; break;
        case 'int32': bytesPerPixel = 4; accessor = dataview.getInt32; break;
        case 'uint32': bytesPerPixel = 4; accessor = dataview.getUint32; break;
        case 'float32': bytesPerPixel = 4; accessor = dataview.getFloat32; break;
        case 'float64': bytesPerPixel = 8; accessor = dataview.getFloat64; break;
        default:
            console.error("Invalid format: " + format);
            return "Invalid format: " + format;
        }
    }

    // ensure file size is consistent
    var expectedLen = w*h*bytesPerPixel
    if (dataview.byteLength != expectedLen) {
        var strError = 'File size of ' + dataview.byteLength + ' does not match expectation of ' + expectedLen + ".";
        console.error(strError);
        return strError;
    }

    var scaledW = 270;
    var scaledH = Math.floor( (scaledW / w) * h + .5 );

    // create a new scalar field
    var scalar = new ScalarField(scaledW, scaledH);
    var view = scalar.view;
    var curByte = 0, curI = 0;
    for (var r = 0; r<scaledH; r++)
    {
        for (var c=0; c<scaledW; c++, curByte += bytesPerPixel, curI++)
        {
            var gx = (c / scaledW) * (w-1);
    		var gy = (r / scaledH) * (h-1);

			var gxi = Math.floor(gx);
			var gyi = Math.floor(gy);

			var i00 = gyi*w    + gxi;
			var i10 = gyi*w    + gxi+1;
			var i01 = (gyi+1)*w + gxi;
			var i11 = (gyi+1)*w + gxi+1;

            var c00 = accessor.call(dataview, i00*bytesPerPixel, littleEndian);
            var c10 = accessor.call(dataview, i10*bytesPerPixel, littleEndian);
            var c01 = accessor.call(dataview, i01*bytesPerPixel, littleEndian);
            var c11 = accessor.call(dataview, i11*bytesPerPixel, littleEndian);


            var result;
            if (c00==emptyData || c10==emptyData || c01==emptyData || c11==emptyData) {
                result = SCALAR_EMPTY;
            }
            else {
                result = blerp(c00, c10, c01, c11, gx-gxi, gy-gyi);
            }
            view[curI] = result;
        }
    }
    scalar.normalize();

    // scale canvas
    var div = d3.select("#binimage1");
    div.selectAll('canvas').remove();
    div.append("canvas").attr('id', 'customFile_' + (customFileSeq++));
    canvasSel = div.select('canvas');

    canvasSel.attr('width', scaledW).attr('height', scaledH);

    // add to list of examples
    examples.addStandalone(scalar, canvasSel.node());
    return 'success';
}

function onChangeUpload(files) {
    if (files.length > 0 && files[0].name.match(/\.(jpg|jpeg|png|gif)$/)) {
        var reader  = new FileReader();

        reader.onloadend = function ()
        {
            //preview.src = reader.result;
            //console.log("data: " + reader.result.length);
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                canvas.getContext('2d').drawImage(this, 0, 0, this.width, this.height);

                var result = visualizeBinFile(canvas, img.width, img.height, 'canvas');
                closePopup();
            }
            img.src = reader.result;

        }
        reader.readAsDataURL(files[0]);
    }
}
