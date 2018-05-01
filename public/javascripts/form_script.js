$( document ).ready(function() {

    // Toggle form fields 

    $('#formFieldsBtn').click(function() {
        $('#formFieldsContent').toggle();
    });

    $('input[type="radio"]').on('click change', function(e) {

        if (document.getElementById('single-burn-radio').checked) {
            document.getElementById('single-burn-coords').style.display = 'block';
            document.getElementById('random-burn-coords').style.display = 'none';
        } else if (document.getElementById('random-burn-radio').checked) {
            document.getElementById('single-burn-coords').style.display = 'none';
            document.getElementById('random-burn-coords').style.display = 'block';
        }
    });
});