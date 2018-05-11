$( document ).ready(function() {

    // Toggle form fields 

    $('#formFieldsBtn').click(function() {
        $('#formFieldsContent').toggle();
    });

    $('input[type="radio"]').on('click change', function(e) {

        if (document.getElementById('single-burn-radio').checked) {
            document.getElementById('single-burn-coords').style.display = 'block';
            document.getElementById('random-burn-coords').style.display = 'none';

            document.getElementById('ignition-lat').required = true;
            document.getElementById('ignition-lon').required = true;
            document.getElementById('lon-min').required = false;
            document.getElementById('lon-max').required = false;
            document.getElementById('lat-min').required = false;
            document.getElementById('lat-max').required = false;

        } else if (document.getElementById('random-burn-radio').checked) {
            document.getElementById('single-burn-coords').style.display = 'none';
            document.getElementById('random-burn-coords').style.display = 'block';

            document.getElementById('lon-min').required = true;
            document.getElementById('lon-max').required = true;
            document.getElementById('lat-min').required = true;
            document.getElementById('lat-max').required = true;
            document.getElementById('ignition-lat').required = false;
            document.getElementById('ignition-lon').required = false;
        }
    });
});