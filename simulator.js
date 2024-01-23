
var CONCURRENT_WORKER = 10;

function JSON2CSV(objArray) {
    var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    var str = '';
    var line = '';

    if (true || $("#labels").is(':checked')) {
        var head = array[0];
        if ($("#quote").is(':checked')) {
            for (var index in array[0]) {
                var value = index + "";
                line += '"' + value.replace(/"/g, '""') + '",';
            }
        } else {
            for (var index in array[0]) {
                line += index + ',';
            }
        }

        line = line.slice(0, -1);
        str += line + '\r\n';
    }

    for (var i = 0; i < array.length; i++) {
        var line = '';

        if ($("#quote").is(':checked')) {
            for (var index in array[i]) {
                var value = array[i][index] + "";
                line += '"' + value.replace(/"/g, '""') + '",';
            }
        } else {
            for (var index in array[i]) {
                line += array[i][index] + ',';
            }
        }

        line = line.slice(0, -1);
        str += line + '\r\n';
    }
    return str;
}

function downloadCSV(arr) {
    json_pre = JSON.stringify(arr);
    var json = $.parseJSON(json_pre);

    var csv = JSON2CSV(json);
    var downloadLink = document.createElement("a");
    var blob = new Blob(["\ufeff", csv]);
    var url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = "data.csv";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}


/* ------------------------------------------------
 * Simulator()
 */
var BENCHMARKS = {
    viridis: [d3.interpolateViridis, 'linear'],
    plasma: [d3.interpolatePlasma, 'linear'],
    cubehelix: ['cubehelix', 'linear'],
    blues: [d3.interpolateBlues, 'linear'],
    greenBlue: [d3.interpolateGnBu, 'linear'],
    redBlue: [d3.interpolateRdBu, 'diverging'],
    spectral: [d3.interpolateSpectral, 'diverging'],
    redGrey: [d3.interpolateRdGy, 'diverging'],
    purpleGreen: [d3.interpolatePRGn, 'diverging'],
    d3rainbow: ['d3rainbow', 'diverging'],
    coolwarmMoreland: ['coolwarmMoreland', 'diverging']

}

function Simulator(n)
{
    if (!n) {
        n = 50;
    }
    this.n = n;
    this.running = 0;
    this.workerPool = [];
    this.workerCount = 0;
    this.data = [];
    this.lum = getLuminanceProfile();

    /*
    // create a worker pool
    for (var i=0; i<Math.min(n, CONCURRENT_WORKER); i++) {
        this.workerPool.push(new WorkerControl(1));
    }
    */
    this.refreshWorkers();
}

function labLength(solution)
{
    var len = 0;
    for (var i=0; i<solution.length-1; i++) {
        var color1 = solution[i];
        var color2 = solution[i+1];

        var lab1 = d3.lab(color1[0], color1[1], color1[2]);
        var lab2 = d3.lab(color2[0], color2[1], color2[2]);

        len += Math.sqrt(
            Math.pow(lab1.l-lab2.l, 2) +
            Math.pow(lab1.a-lab2.a, 2) +
            Math.pow(lab1.b-lab2.b, 2)
        );
    }
    return len;

}

function avgChroma(solution)
{
    var C = 0;
    for (var i=0; i<solution.length; i++) {
        var color = solution[i];
        var lab = d3.lab(color[0], color[1], color[2]);
        var hcl = d3.hcl(lab);
        if (!isNaN(hcl.c)) {
            C += hcl.c;
        }
    }
    return C/solution.length;
}

function globalDistance(solution)
{
    var D = 0;
    var count = 0;
    for (var i=1, len = solution.length; i<len; i++ )
    {
        var color0 = solution[i];
        var lab0 = d3.lab(color0[0], color0[1], color0[2]);

        for (var j=0; j<i; j++)
        {
            var color = solution[j];
            var lab = d3.lab(color[0], color[1], color[2]);

            D += _cie2000Diff(lab0, lab);
            count++;
        }
    }
    if (count > 0) {
        return D/count;
    } else {
        return 0;
    }
}
var _cvd_model = new ColorTransform(CVD_MATRIX.deuteranomaly);

Simulator.prototype.evaluateSolution = function(package, name, profile)
{
    var solution = package.solution;
    var uniformity = perceptualUniformityPenalty(solution);
    var smoothness1 = anglePenalty(solution);
    var sample2 = this.lum.getKeyMultiples(Math.floor(solution.length * 0.5));
    var smoothness2 = anglePenalty(solution, sample2);
    var lLen = labLength(solution);

    var cvdSolution = [];
    var cvdModel = _cvd_model || getCVDModel();
    if (cvdModel) {
        for (var i=0; i<solution.length; i++) {
            var color = solution[i];
            var cvdColor = cvdModel.transformLAB(d3.lab(color[0], color[1], color[2]));
            cvdSolution.push([
                cvdColor.l, cvdColor.a, cvdColor.b
            ]);
        }
    }

    var record = {
        id: name ? name : 'solution' + (1+this.data.length),
        smoothness1: smoothness1,
        smoothness2: smoothness2,
        uniformity: uniformity,
        chroma: avgChroma(solution),
        globalDiscriminability: globalDistance(solution),
        labLength: lLen,
        logLabLength: Math.log(lLen),
        time: package.totalTime || 0,
        profile: profile ? profile : this.lum.profileType,
        cvdDiscriminability: cvdModel ? globalDistance(cvdSolution) : 0
    };
    return record;
}


Simulator.prototype.refreshWorkers = function()
{
    if (this.data.length >= this.n) {
        return true;
    }
    else {
        for (var i=this.running; i<CONCURRENT_WORKER && this.workerCount < this.n; i++)
        {
            var worker = new WorkerControl(1);
            worker.updateEvery = null;

            // increment number of workers
            this.workerCount++;

            (function(_worker, workerID, obj)
            {
                obj.running++;
                function callback(solution, final)
                {
                    if (final)
                    {
                        obj.running--;

                        // evaluate solution and add to data
                        var record = obj.evaluateSolution(solution[0]);
                        obj.data.push(record);

                        // delete worker
                        _worker.stopWork();

                        // are we at the end?
                        if (obj.data.length == obj.n)
                        {
                            // add BENCHMARKS
                            for (name in BENCHMARKS)
                            {
                                if (!BENCHMARKS.hasOwnProperty(name)) {
                                    continue;
                                }
                                var interp = BENCHMARKS[name][0];
                                var profile = BENCHMARKS[name][1];

                                var colormap = null;
                                if (typeof interp === 'string' || interp instanceof String) {
                                    colormap = getColorPreset(interp);
                                }

                                var benchSolution = [];
                                for (var s=0, len=solution[0].solution.length; s<len; s++)
                                {
                                    var I = s/(len-1);
                                    var color = d3.lab(colormap ? colormap.mapValue(I) : interp(I));
                                    benchSolution.push([color.l, color.a, color.b]);
                                }
                                obj.data.push(obj.evaluateSolution({ solution: benchSolution }, name, profile));
                            }

                            downloadCSV(obj.data);
                        }
                        else {
                            console.log("complete: " + (100*obj.data.length / obj.n).toFixed(2) + '%');
                            obj.refreshWorkers();
                        }
                    }
                }

                // perturb luminance range, randomly and slightly
                LRANGE[0] = 5  + Math.floor(.5+ Math.random()*10);
                LRANGE[1] = 95 - Math.floor(.5+ Math.random()*10);

                _worker.startWork(callback);
            })(worker, i, this);
        }
    }
    return false;
}
