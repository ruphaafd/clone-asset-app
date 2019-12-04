$(document).ready( function() {
    app.initialized()
        .then(function(_client) {   
          var client = _client;
          client.events.on('app.activated',
            function() {
                client.interface.trigger("showModal", { 
                    title: "Clone Asset", 
                    template: "templates/modal.html"
                });
            });
        });
});
