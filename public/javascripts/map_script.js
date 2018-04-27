
$( document ).ready(function() {

    // Layers for OpenLayers map
    var layerConfigs = [{title: 'DigitalGlobeRecentImagery',
    extent: null,
    sourceConfig: {type: 'DigitalGlobe',
                    imageryId: 'digitalglobe.nal0g75k',
                    accessToken: 'pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqM2RuZTE3dTAwMncyd3Bwanh4MHJ1cmgifQ.LNrR2h_I0kz6fra93XGP2g'}},
    {title: 'DigitalGlobeRecentImagery+Streets',
    extent: null,
    sourceConfig: {type: 'DigitalGlobe',
                    imageryId: 'digitalglobe.nal0mpda',
                    accessToken: 'pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNqM2RuZTE3dTAwMncyd3Bwanh4MHJ1cmgifQ.LNrR2h_I0kz6fra93XGP2g'}}];

    // Initialize OpenLayers map
    var mapConfig = mercator.createMap('map', [-120.8958, 38.8375], 6, layerConfigs);

    // View OpenLayers map 
    var layerDigitalGlobe = 'DigitalGlobeRecentImagery';
    var layerDigitalGlobeStreets = 'DigitalGlobeRecentImagery+Streets';

    mercator.setVisibleLayer(mapConfig, layerDigitalGlobeStreets);

    // Add overlay for form fields 
    mercator.addOverlay(mapConfig, '#sampleFields');
    
    // Enable dragbox interaction (lon-min, lat-min, lon-max, lat-max are the coordinate input fields)
    var displayDragBoxBounds = function (dragBox) {
    var extent = dragBox.getGeometry().clone().transform("EPSG:3857", "EPSG:4326").getExtent();
        document.getElementById("lon-min").value = extent[0];
        document.getElementById("lat-min").value = extent[1];
        document.getElementById("lon-max").value = extent[2];
        document.getElementById("lat-max").value = extent[3];
    };
    mercator.enableDragBoxDraw(mapConfig, displayDragBoxBounds);
});

