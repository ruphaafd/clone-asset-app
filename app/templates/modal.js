$(document).ready( function() {
    app.initialized()
        .then(function(_client) {
        var client = _client;
        
        // initializing the state manager object
        CONSTANTS.uiState = new UIStateManager(client);
        
        // gets iparams - domainName and apiKey from the user input
        client.data.get('domainName').then(
            function(data) {
                CONSTANTS.domainName = `https://${data.domainName}`;
                CONSTANTS.options = {
                    headers: {
                        'Authorization': 'Basic <%= encode(iparam.apiKey) %>',
                        'Content-Type': 'application/json',
                    }
                };
                // Step-1 --> Get the asset object available in that page
                client.data.get('asset')
                .then(function(data) {
                    CONSTANTS.uiState.setState("prepare");
                    getAssetDetails(data, client)
                        .then(getAssetTypeDetails)
                        .catch(showError);
                })
                .catch(showError);
            },
            function(error) {
                console.log('Error in retrieving iparams', error);
            }
        );   

        // Step-2 --> Get the asset type fields for that particular asset type
        function getAssetTypeDetails(data) {
            var url = CONSTANTS.domainName + formatString(CONSTANTS.urls.getAssetTypeFields, data.asset_type_id)
            client.request.get(url, CONSTANTS.options)
                    .then(function(data) {
                        CONSTANTS.uiState.setState('init');
                        var res = JSON.parse(data.response) || {};
                        populateUniqueFields(res.asset_type_fields, client);
                        $('.loading-wrapper').hide();
                    })
                    .catch(showError);
        }

        function showError(err) {
            console.log('Error --->', err)
            showErrorMessage(client, 'generic')
        }

        // Binds all the dom elements with their respecttive events
        bindUIEvents(client);
    });
});
