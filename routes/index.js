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
        ignition-row
        ignition-col
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
        var ignitionRow = req.body['ignition-row'];
        var ignitionCol = req.body['ignition-col'];

        var maxRuntime = req.body['max-runtime'];
        var temperature = req.body['temperature'];
        var relativeHumidity = req.body['relative-humidity'];
        var windSpeed20ft = req.body['wind-speed-20ft'];
        var windFromDirection = req.body['wind-from-direction'];
        var foliarMoisture = req.body['foliar-moisture'];
        var ellipseAdjustmentFactor = req.body['ellipse-adjustment-factor'];
        var simulations = req.body['simulations'];
        var randomSeed = req.body['random-seed'];

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
                                    edn.kw(":ignition-row"), eval(ignitionRow), 
                                    edn.kw(":ignition-col"), eval(ignitionCol),
                                    edn.kw(":max-runtime"), eval(maxRuntime),
                                    edn.kw(":temperature"), eval(temperature),
                                    edn.kw(":relative-humidity"), eval(relativeHumidity),
                                    edn.kw(":wind-speed-20ft"), eval(windSpeed20ft),
                                    edn.kw(":wind-from-direction"), eval(windFromDirection),
                                    edn.kw(":foliar-moisture"), eval(foliarMoisture),
                                    edn.kw(":ellipse-adjustment-factor"), eval(ellipseAdjustmentFactor),
                                    edn.kw(":simulations"), eval(simulations),
                                    edn.kw(":random-seed"), eval(randomSeed),
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
