
importScripts('lib/d3-color.js', 'luminance.js', 'optimizer.js', 'cvd.js');

var TERMINATE_WORKER = false;
onmessage = function(msg)
{

    // initialize parameters for optimization
    var data = msg.data;
    if (data.terminate)
    {
        // terminate worker
        //console.log("TERMINATE!!!!");
        TERMINATE_WORKER = true;
        return;
    }

    // luminance profile
    PROFILE_DEFINED = data.luminanceProfile;

    // luminance range
    LRANGE = data.LRANGE;

    // number of iterations
    ITERATIONS_PER_TEMP = data.iterationsPerTemp;

    // smoothness
    SMOOTHNESS = data.smoothness;

    // keys
    DESIRED_KEYS = data.desiredKeys;

    // block and user strength configurations
    MIN_BLOCK_SIZE = data.minBlockSize;
    MAX_PREF_STRENGTH = data.maxPrefStrength;

    if (data.initialTemp) {
        INITIAL_TEMP = data.initialTemp;
        console.log("initial temperature: " +INITIAL_TEMP);

    }
    if (data.alpha) {
        ALPHA_TEMP = data.alpha;
    }
    if (data.taperWalkLen) {
        TAPER_WALK_LEN = data.taperWalkLen;
        console.log("taper walk len: " +TAPER_WALK_LEN);
    }

    // cvd modeling
    if (data.cvdModel) {
        buildCVD(data.cvdModel);
    }

    // if worker index greater than zero, silence log
    var workerIndex = data.workerIndex;
    if (workerIndex > 0) {
        console.log = function() {};
    }


    // user bias
    var userBias = data.userBias;

    // send data every
    var exitEvery = data.exitEvery;

    /*
    console.log('profile defined: ' + PROFILE_DEFINED);
    console.log('lrange: ' + LRANGE);
    console.log('DESIRED_KEYS: ' + data.desiredKeys);
    */

    // cvd model
    if (data.cvdModelName) {
        buildCVD(data.cvdModelName);
    }

    // start the optimizer
    var optimizer = new Optimizer();
    var finished = false;

    // estimate total iterations
    var totalIter = optimizer.estimateTotalIteration();
    var startTime = Date.now();
    var solution = null, curIter = 0, percentDone = 0;

    while (!finished && !TERMINATE_WORKER)
    {
        finished = optimizer.optimize(userBias, exitEvery, data.initialSolution);
        solution = optimizer.getSolution();
        curIter = optimizer.lastState ? optimizer.lastState.totalIter : 0;
        percentDone = optimizer.lastState ? optimizer.lastState.percentDone : 0;

        if (!finished)
        {
            // post message with partial solution
            self.postMessage({
                complete: false,
                solution: solution,
                totalIter: totalIter,
                curIter: curIter,
                percentDone: percentDone
            });
        }
    }

    var totalTime = Date.now() - startTime;
    self.postMessage({
        complete: true,
        solutionCost: optimizer.solutionCost,
        solution: optimizer.getSolution(),
        totalIter: totalIter,
        curIter: totalIter,
        totalTime: totalTime,
        percentDone: 1
    });
}
