var express = require('express');
var router = express.Router();
var fs = require('fs');
var Slider = require('bootstrap-slider');
var jsdom = require('jsdom');
var $ = require('jquery')(new jsdom.JSDOM().window);

// Unique session id 
var crypto = require('crypto');

var generate_session_id = function() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex');
}

var session_id = generate_session_id();

console.log("\n----------\nSession_id for this user: ", session_id);
console.log("\n\n"); 

// Javascript implementation of EDN for Clojure
var edn = require('jsedn');

// Connection to PostgreSQL / PostGIS 
var pg = require("pg");
// var connectPostgres = "postgres://USERNAME:PASSWORD@127.0.0.1/dbname";

var checkVals = function (val) { 

    /*var valOut;
    var valLength = val.length;
    var valAcc = '';

    try {
        if (val[0] == '[') {
            console.log('val is array...');    
        } else if (val[0] == '(') {
            console.log('val is list...');
        } else {
            console.log('val is scalar...');
            valOut = JSON.parse(val);
        }
    } catch(err) {
        valOut = 'Error in checkVals(val)';
    }

    console.log('---------\n');

    return valOut;*/

    console.log('\n!!!!!!!!!! checkVals()');
    console.log('param: ', val);
    console.log('!!!!!!!!!\n');

    var tryVal = getFormType(val);

    return tryVal;
}

var getStringElements = function (val, valAcc = '') {
    if (val.length == 0) {
         return valAcc;	
    } else {
        if ((val[0] == '[') || (val[0] == '(')) {
               valAcc += val[0];
               return getStringElements(val.substring(1), valAcc = valAcc);
        } else if ((val[0] == ']') || (val[0] == ')')) {
               valAcc += val[0];
               return getStringElements(val.substring(1), valAcc = valAcc);
        } else if (val[0] == " ") {
             valAcc += ",";
            return getStringElements(val.substring(1), valAcc = valAcc);
        } else {
            valAcc += val[0];
            return getStringElements(val.substring(1), valAcc = valAcc);
        }
    }
}

function getFormType (form) {
    var tryList = isValidList(form);
    var tryVector = isValidVector(form);
    var tryScalar = isValidScalar(form);

    var tryValidator = validateEdnInput(form);

    console.log('\n\n++++++++++++++++\nWithin getFormType()...');
    console.log('tryList: ', tryList);
    console.log('tryVector: ', tryVector);
    console.log('tryScalar: ', tryScalar);
    console.log('tryValidator: ', tryValidator);
    console.log('++++++++++++++\n');

    var newForm = form; 

    if (tryScalar == true) {
        newForm = JSON.parse(form);
    }

    return newForm; 
}

// Gary code for POST validation - return TRUE / FALSE 

function isValidList (form) {
    return typeof form == "object" &&
        !Array.isArray(form) &&
        Object.keys(form).length == 1 &&
        Object.keys(form)[0] == "List" &&
        form["List"].length > 0 &&
        form["List"].every(function (x) { return typeof x == "number";});
}

function isValidVector (form) {
    return typeof form == "object" &&
        !Array.isArray(form) &&
        Object.keys(form).length == 1 &&
        Object.keys(form)[0] == "Vector" &&
        form["Vector"].length == 2 &&
        form["Vector"].every(function (x) { return typeof x == "number";});
}

function isValidScalar (form) {
    var newForm = JSON.parse(form);
    //return typeof form == "number";
    return typeof newForm == "number";
}

function validateEdnInput (input) {
    /*var form = edn.encodeJson(edn.parse(input));
    return isValidList(form) || isValidVector(form) || isValidScalar(form);*/

    //var form = edn.encodeJson(edn.parse(input));
    var parseInput = edn.parse(input);
    var encodeInput = edn.encodeJson(parseInput);

    var tmpParse; 
    var form; 

    try {

        console.log('\n------------------\nWithin validateEdnInput try()');
        console.log('input: ', input);

        tmpParse = edn.parse(input);

        console.log('edn.parse(input): ', edn.parse(input));

        form = edn.encodeJson(tmpParse);

        console.log('edn.encodeJson(tmpParse): ', edn.encodeJson(tmpParse));
        console.log('----------------\n\n');

    } catch (err) {

        console.log('\n------------------\nWithin validateEdnInput catch()');
        console.log('input: ', input);
        console.log('edn.encodeJson(input): ', edn.encodeJson(input));
        console.log('------------------\n\n');

        form = edn.encodeJson(input);
    }

    console.log('\n......................\n In validateEdnInput()');
    console.log('parseInput: ', parseInput);
    console.log('encodeInput: ', encodeInput);
    console.log('...................\n');

    return isValidList(form) || isValidVector(form) || isValidScalar(form);
}

// SQL for PostGIS

/*
-- CREATE VIEW schema.table (~= namespace/var in Clojure)
-- e.g. clips = schema, canpoy_height = table 
-- CREATE VIEW => non-caches, run everytime (non-memoized)
-- CREATE TABLE => caches (memoized)
CREATE VIEW clips.<table_name>_<session_id> AS
  -- Create vars | Need to convert string to PostGIS geometry obj
  WITH geom AS ST_GeomFromGeoJSON(<geojson_polygon>)
    -- ST_Clip applies to each tile
    -- ST_Union aggregates (union) all clipped tiles into 1 tile
    SELECT ST_Union(ST_Clip(rast, geom)) AS rast
      -- landfire.<table_name> sequence of maps {:rid int :rast raster}
      FROM landfire.<table_name>
      WHERE ST_Intersects(rast, geom);
    -- LIMIT 10; -- same Clojure (take 10)
    -- WHERE => Clojure (filter ST_Intersects())
    -- FROM => sequence generator
    -- ORDER BY => Clojure (sort) or (sort-by)
    -- e.g. ORDER BY <field> (age)
    -- WITH => (Clojure let) bind names to exp [sequence calls]
    -- CREATE => (Clojure def)
    -- SELECT => (Clojure Map or Reduce)

-- raster2pgsql -t width x height (-t = tiles raster)
-- one CREATE VIEW for each LANDFIRE layer
-- Within .edn file calls clips.canopy_height_<session_id>
*/

/* 
// GET map page 
router.get('/map', function(req, res) {
    var client = new pg.Client(connectPostgres);
    client.connect();
    var query = client.query("SELECT lname FROM sample_layer");
    query.on("row", function(row, result) {
        result.addRow(row);
    });

    query.on("end", function(result) {
        res.render('map', {
            "layers": (result.rows),
            title: 'GridFire.ui',
            lat: 40.7795213,
            lng: -73.9641241
        });
    });
});
*/

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'GridFire Interface', error: null });
});

/* POST event */
router.post('/', function(req, res) {

    /* Parameters for GridFire Clojure model 
        ignition-lat
        ignition-lon
        max-runtime
        temperature
        relative-humidity
        wind-speed-20ft
        wind-from-direction
        foliar-moisture
        ellipse-adjustment-factor
        simulations
        random-seed
    */

    /* Send POST to .edn file for Clojure */

    try {

        // Single vs random burn sites 
        var checkRadio = req.body.radio;
        var ignitionLat = '';
        var ignitionLon = '';
        var lonMin = '';
        var lonMax = '';
        var latMin = '';
        var latMax = '';

        if (checkRadio == 'isSingle') {
            ignitionLat = req.body['ignition-lat'];
            ignitionLon = req.body['ignition-lon'];
        } else {

            lonMin = req.body['lon-min'];
            lonMax = req.body['lon-max'];
            latMin = req.body['lat-min'];
            latMax = req.body['lat-max'];

            ignitionLat = latMin + ',' + latMax;
            ignitionLon = lonMin + ',' + lonMax; 

        }

        var maxRuntime = req.body['max-runtime'];
        var temperature = req.body['temperature'];
        var relativeHumidity = req.body['relative-humidity'];
        var windSpeed20ft = req.body['wind-speed-20ft'];
        var windFromDirection = req.body['wind-from-direction'];
        var foliarMoisture = req.body['foliar-moisture'];
        var ellipseAdjustmentFactor = req.body['ellipse-adjustment-factor'];
        var simulations = req.body['simulations'];
        var randomSeed = req.body['random-seed'];

        /*console.log('\nmaxRuntime: ', maxRuntime);
        console.log('temperature: ', temperature);

        var temperatureMod = getStringElements(temperature);
        var relativeHumidityMod = getStringElements(relativeHumidity);

        console.log('temperatureMod: ', temperatureMod);
        console.log('relativeHumidity: ', relativeHumidity);
        console.log('relativeHumidityMod: ', relativeHumidityMod);*/

        console.log('\nPulled all variables from req.body...\n');

        // Convert JS to EDN object (Map) 
        var ednMap = new edn.Map([edn.kw(":db-spec"), 
                            new edn.Map([edn.kw(":classname"), "org.postgresql.Driver",
                                edn.kw(":subprotocol"), "postgresql",
                                edn.kw(":subname"), "//localhost:5432/gridfire",
                                edn.kw(":user"), "gridfire"]),
                            edn.kw(":landfire-layers"),
                            new edn.Map([edn.kw(":elevation"), "clip.dem_" + session_id,
                                edn.kw(":slope"), "clip.slp_" + session_id,
                                edn.kw(":aspect"), "clip.asp_" + session_id,
                                edn.kw(":fuel-model"), "clip.fbfm40_" + session_id,
                                edn.kw(":canopy-height"), "clip.ch_" + session_id,
                                edn.kw(":canopy-base-height"), "clip.cbh_" + session_id,
                                edn.kw(":crown-bulk-density"), "clip.cbd_" + session_id,
                                edn.kw(":canopy-cover"), "clip.cc_" + session_id]),
                                    edn.kw(":srid"), "CUSTOM:900914",
                                    edn.kw(":cell-size"), 98.425,
                                    /*edn.kw(":ignition-row"), checkVals(ignitionLat), 
                                    edn.kw(":ignition-col"), checkVals(ignitionLon),
                                    edn.kw(":max-runtime"), checkVals(maxRuntime),
                                    edn.kw(":temperature"), checkVals(temperature),
                                    edn.kw(":relative-humidity"), checkVals(relativeHumidity),
                                    edn.kw(":wind-speed-20ft"), checkVals(windSpeed20ft),
                                    edn.kw(":wind-from-direction"), checkVals(windFromDirection),
                                    edn.kw(":foliar-moisture"), checkVals(foliarMoisture),
                                    edn.kw(":ellipse-adjustment-factor"), checkVals(ellipseAdjustmentFactor),
                                    edn.kw(":simulations"), checkVals(simulations),
                                    edn.kw(":random-seed"), checkVals(randomSeed),*/
                                    edn.kw(":ignition-row"), ignitionLat, 
                                    edn.kw(":ignition-col"), ignitionLon,
                                    edn.kw(":max-runtime"), maxRuntime,
                                    edn.kw(":temperature"), temperature,
                                    edn.kw(":relative-humidity"), relativeHumidity,
                                    edn.kw(":wind-speed-20ft"), windSpeed20ft,
                                    edn.kw(":wind-from-direction"), windFromDirection,
                                    edn.kw(":foliar-moisture"), foliarMoisture,
                                    edn.kw(":ellipse-adjustment-factor"), ellipseAdjustmentFactor,
                                    edn.kw(":simulations"), simulations,
                                    edn.kw(":random-seed"), randomSeed,
                                    edn.kw(":outfile-suffix"), "_tile_100",
                                    edn.kw(":output-landfire-inputs?"), true,
                                    edn.kw(":output-geotiffs?"), true,
                                    edn.kw(":output-pngs?"), true,
                                    edn.kw(":output-csvs?"), true]);

        console.log("\nednMap: ", ednMap);
        console.log("+++++++++++++++++++\n");

        // Encode EDN Map
        var ednObj = edn.encode(ednMap);

        fs.writeFile('sample_params.edn', ednObj, function(err, ednObj) {
            if (err) console.log(err);
            console.log('\nWrote params to file sample_params.edn.\n');
        });

        res.render('index', { title: 'GridFire Interface', error: null });

    } catch(err) {
        res.render('index', { title: 'GridFire Interface', error: 'Error, please try again!' });
    }
})

module.exports = router;
