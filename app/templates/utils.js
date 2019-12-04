// Queue to execute API calls sequentially
function ExecutionQueue() {
    this.queue = []
};
ExecutionQueue.prototype = {
    constructor: ExecutionQueue,
    enqueue: function (fn, queueName) {
        this.queue.push({
        name: queueName || 'global',
        fn: fn || function (next) {
            next()
        }
        });
        return this
    },
    dequeue: function (queueName) {
        var allFns = (!queueName) ? this.queue : this.queue.filter(function (current) {
        return (current.name === queueName)
        });
        var poppedFn = allFns.pop();
        if (poppedFn) poppedFn.fn.call(this);
        return this
    },
    dequeueAll: function (queueName, completionCallback) {
        var instance = this;
        var queue = this.queue;
        var allFns = (!queueName) ? this.queue : this.queue.filter(function (current) {
        return (current.name === queueName)
        });
        (function recursive(index) {
        var currentItem = allFns[index];
        if (!currentItem) { completionCallback && completionCallback(); return ; }
        currentItem.fn.call(instance, function () {
            queue.splice(queue.indexOf(currentItem), 1);
            recursive(index);
        })
        }(0));
        return this
    }
};

/**
 * State manager helper to control the UI manipulations - for each state
 * @param {Object} client 
 * @constructor
 */
function UIStateManager(client) {
    this.client = client;
    this.states = [ "prepare", "init", "inprogress", "incomplete", "complete" ];
    this.dom = {
        $quantityInput   : $('#quantity'),
        $cloneBtn        : $('#clone'),
        $startOverBtn    : $('#startOver'),
        $cancelBtn       : $('#cancel'),
        $responseList   : $('#response-list'),
        $uniqFieldsList : $('#unique-fields-list'),
        $fieldsInfo      : $('.unique-fields-title')
    }
};
UIStateManager.prototype = (function(){ 

var prepare = function() {
    // App rendering state
    this.dom.$quantityInput.attr("disabled", "disabled");
    this.dom.$cloneBtn.addClass('disabled');
    this.dom.$cancelBtn.addClass('disabled');
    this.dom.$fieldsInfo.hide();
};

var init = function() {
    // Page render - Initial conditions
    this.dom.$quantityInput.removeAttr("disabled");
    this.dom.$cloneBtn.removeClass('disabled');
    this.dom.$cancelBtn.removeClass('disabled');
    this.dom.$startOverBtn.hide();
    this.dom.$responseList.empty();
    this.dom.$uniqFieldsList.show();
    this.dom.$fieldsInfo.show();
    constructUniqueFieldsDOM(CONSTANTS.quantity, this.client);
};

var inprogress = function() {
    // Cloning in progress
    this.prepare();
    populateAssetList();
    bulkCreateAssets(this.client);
};

var incomplete = function() {
    // Cloning done with some error cases
    this.dom.$quantityInput.attr("disabled", "disabled");
    this.dom.$cloneBtn.removeClass('disabled');
    this.dom.$cancelBtn.removeClass('disabled');
};

var complete = function() {
    // Cloning done with complete success
    this.dom.$quantityInput.attr("disabled", "disabled");
    this.dom.$cloneBtn.addClass('disabled');
    this.dom.$cancelBtn.removeClass('disabled');
    this.dom.$startOverBtn.show();
}


return {
    prepare: prepare,
    init: init,
    inprogress: inprogress,
    incomplete: incomplete,
    complete: complete,
    setState : function(state) {
        return this.states.indexOf(state) > -1 && this[state]();
    }
}
})();

/**
 * String formatting helper
 * @param {*} str 
 * @param {*} args 
 * @usage: formatString('/assets/{0}', 5) --> '/assets/5'
 */
const formatString = function(str, args) {
    var formatted = str;
    if(Array.isArray(args)) {
        $.each(args, function(arg, i){
            formatted = formatted.replace("{" + i + "}", arg);
        });
    } else if((typeof args === "string") || (typeof args === "number")) {
        formatted = formatted.replace("{" + 0 + "}", args);
    }
    return formatted;
}

/**
 * populates an object with unique fields to be constructed
 * @param {Array of Object} fields 
 * @param {Object} client
 *
 */ 
const populateUniqueFields = function(fields, client) {
    fields.forEach(function(field) {
        let filtered = [];
        let defaultFilter = function(fields, type, isGeneral) {
            return fields.filter(function(f) { 
                return isGeneral ? (f.is_unique && !(["Display Name","Asset Tag"].includes(f.label))) :(f.label.indexOf(type) > -1);
            });
        };
        let fHeader = field["field_header"];
        if(["Assignment", "General"].indexOf(fHeader) > -1) { filtered = defaultFilter(field["fields"], "default_display_name", true); } 
        else if(fHeader in CONSTANTS.defaultFilter) { filtered = defaultFilter(field["fields"], CONSTANTS.defaultFilter[fHeader]); }

        Array.prototype.push.apply(CONSTANTS.uniqueFields, filtered);
    });
    constructUniqueFieldsDOM(CONSTANTS.quantity, client);
}

/**
 * constructs the dom elements based on the unique fields extracted
 * @param {Number} quantity 
 * @param {Object} client
 *
 */ 
const constructUniqueFieldsDOM = function(quantity) {
    var uniqueFields = CONSTANTS.uniqueFields;
    var $uniqFieldsList = $('#unique-fields-list');
    $uniqFieldsList.empty();
    if(validateQuantity(quantity)) {
       for(let i = 0; i < quantity; i++) {
           var $row = $(`<div class="field-row">
                       </div>`);
           var $fields = $('<div class="fields"></div>')
           for(let j = 0; j < uniqueFields.length; j++) {
               var $field = $(`
                   <div class="field">
                       <label>${uniqueFields[j].label}</label>
                       <input type="hidden" value=${uniqueFields[j].name} class="field-title">
                       <input type="text" class="field-value" value="${(uniqueFields[j].field_type == 'default_display_name') ? `Copy${i+1} of ${CONSTANTS.asset[uniqueFields[j].name]}` : ''}">
                   </div>
               `);
               $fields.append($field);
           }
           $row.append($fields);
           $uniqFieldsList.append($row);
       }
    } else {
        var $error = $("<span class='error-message'>" + CONSTANTS.errorsMessages.quantity + "</span>")
        $('.quantity-input')
            .find('#quantity').addClass('error').end()
            .append($error);
    }
};

/**
 * removes the null values from a nested object
 * @param {Object} obj
 *
 */ 
const cleanObject = function(obj) {
    Object.entries(obj).forEach(function([key, val]) {
        if(val && typeof val === 'object') { cleanObject(val); }
        else if(val === null) { delete obj[key]; }
    });
    delete obj.id;
    delete obj.display_id;
    delete obj.author_type;
    delete obj.created_at;
    delete obj.updated_at;

    return obj
}

// validates if the user has entered a correct quantity
const validateQuantity = function(quantity) {
    return !!(quantity && quantity > 0 && quantity <= 15) ;
};

// Shows flash error message
const showErrorMessage = function(client, type) {
    client.interface.trigger("showNotify", {
        type: "error",
        message: CONSTANTS.errorsMessages[type]
      });
}

/**
 * create Asset objects with the rest of the fields compatible to make an api request
 * @param {Array of Object} inputList
 *
 */ 
const manipulateAssetList = function(inputList) {
    CONSTANTS.assetList = [];
    var clonedAsset = $.extend( true, {}, CONSTANTS.asset); // parent asset cloned
    inputList.forEach(function(obj) {
        Object.keys(obj).forEach(function(key) {
            if(clonedAsset.hasOwnProperty(key)) {
                clonedAsset[key] = obj[key];
            } else if(clonedAsset["type_fields"].hasOwnProperty(key)) {
                clonedAsset["type_fields"][key] = obj[key];
            }
        });
        CONSTANTS.assetList.push(cleanObject($.extend(true, {}, clonedAsset)));
    });
};

/**
 * callback after every asset creation calls are called
 * 
 *
 */ 
const postCreateExecution = function() {
    toggleLoader();
    if(CONSTANTS.response.error > 0) {
        CONSTANTS.uiState.setState("incomplete");
    } else {
        CONSTANTS.uiState.setState("complete");
    }
}

// toggles the loader depending on the cloning state
const toggleLoader = function(show) {
    var $loader = $('.sticky-footer .loading');
    if(show) {
        $loader.find('.clone-assets').text('Cloning '+CONSTANTS.assetList.length+' assets...');
        $loader.show();
    } else {
        $loader.hide();
    }
}

// binds all the UI events
const bindUIEvents = function(client) {
    // Delegating events to the listeners
    const parentContainer = $('#clone-container');

    parentContainer.on('change', '#quantity', function() {
        var $quantityEl = $('.quantity-input');
        CONSTANTS.quantity = $quantityEl.find('#quantity').val();
        $quantityEl.find('#quantity').removeClass('error')
        $quantityEl.find('.error-message').empty();
        CONSTANTS.uiState.setState('init');
    });

    parentContainer.on('click', '#cancel', function() {
        client.instance.close();
    });

    parentContainer.on('click', '#clone', function() {
        // $('#clone').addClass('disabled');
        CONSTANTS.uiState.setState('inprogress');
    });

    parentContainer.find('#response-list').on('keyup', 'input.field-value', function() {
        $(this).closest('.field').find('.error-message').hide();
        $(this).removeClass('error');
    });

    parentContainer.on('click', '#startOver', function() {
        CONSTANTS.uiState.setState("init");
    });
}

// makes an api call to get the asset details given the asset type id
const getAssetDetails = function(data, client) {
    return new Promise(function(resolve, reject) {
        CONSTANTS.asset = {};
        let display_id = data.asset.display_id;
        let url = CONSTANTS.domainName+formatString(CONSTANTS.urls.getAsset, display_id)
        client.request.get(url, CONSTANTS.options)
            .then(function(data) {
                CONSTANTS.asset = JSON.parse(data.response).asset;
                resolve(CONSTANTS.asset);
            }).catch(function(err) {
                reject(err);
            });
    });
};

// Creating assets in bulk
const bulkCreateAssets = function(client) {
    CONSTANTS.response = {
        success: 0,
        error: 0
    }
    var cloneQueue = new ExecutionQueue();
    for(let i=0; i<CONSTANTS.assetList.length; i++) {
        cloneQueue.enqueue(function(next) {
            createAsset(client, CONSTANTS.assetList[i], next);
        });
    }
    toggleLoader(true)
    cloneQueue.dequeueAll(null, postCreateExecution);
};

// extract the values from the input fields to construct the list of assets
const populateAssetList = function() {
    const $fields = $('.field-row');
    let uniqueAssets = [];
    $.each($fields, function(i, val) {
        const fieldsList = $(val).find('.field');
        let fieldObj = {};
        $.each(fieldsList, function(i, val) {
            fieldObj[$(val).find('.field-title').val()] = $(val).find('.field-value').val();
        })
        uniqueAssets.push(fieldObj);
    });
    $('#response-list').find('.field-row').remove();
    manipulateAssetList(uniqueAssets);
};

/**
 * Serial Network calls - Execution Queue
 * @param {Object} client
 * @param {Object} data // Asset object
 * @param {Function} cb
 *
 */ 
const createAsset = function(client, data, cb) {
    var data = {
        headers: CONSTANTS.options.headers,
        json: data
    }
    var url = CONSTANTS.domainName + formatString(CONSTANTS.urls.createAsset)
    var requestData = data.json;
    client.request.post(url, data)
        .then(function(data) {
            constructResponseModel(data.response, requestData, true, client)
            cb && cb();
        })
        .catch(function(err) {
            constructResponseModel(err, requestData, null, client)
            cb && cb();
        });
}

/**
 * constructs the elements post-creation of assets
 * @param {Object} requestData
 * @param {Boolean} isSuccess
 * @param {Object} client
 *
 */ 
const constructResponseModel = function(result, requestData, isSuccess, client) {
    var uniqueFields = CONSTANTS.uniqueFields;
    if(isSuccess) {
        ++CONSTANTS.response.success;
        const rAsset = result.asset;
        var $responseAssets = $('<div class="response-row"></div>');
        for(let i = 0; i < uniqueFields.length; i++) {
            var name = rAsset[uniqueFields[i].name] || rAsset["type_fields"][uniqueFields[i].name];
            var assetUrl = `${CONSTANTS.domainName}/cmdb/items/${rAsset["display_id"]}`;
            var value = (uniqueFields[i].name != "name") ? name
                            : `<a href="${assetUrl}" target="_blank">${name}</a>`; 
            var $responseField = $(`
                <div class="response-field">
                    <label>${uniqueFields[i].label}</label>
                    <div class="rValue">${value}</div>
                </div>  
            `);
            $responseAssets.append($responseField);
        }
        var $assetLink = $('<div class="asset-link"><img alt="tick" src="tick.svg"/></div>');
        $responseAssets.append($assetLink);
        $('#unique-fields-list').empty().hide();
        $('#response-list').append($responseAssets).show();
    } else {
        ++CONSTANTS.response.error;
        var errors = result.response && result.response.errors;
        if(errors) {
            var $row = $(`<div class="field-row unsent"></div>`);
            var $fields = $('<div class="fields"></div>');
            for(let j = 0; j < uniqueFields.length; j++) {
                var errorValue = requestData.hasOwnProperty([uniqueFields[j].name])
                                        ? requestData[uniqueFields[j].name] 
                                        : requestData["type_fields"][uniqueFields[j].name];
                var name = uniqueFields[j].name;
                var $field = $(`
                    <div class="field">
                        <label>${uniqueFields[j].label}</label>
                        <input type="hidden" value=${name} class="field-title">
                        <input type="text" data-id=${name} 
                               class="field-value" 
                               value='${errorValue}'>
                    </div>
                `);
                $fields.append($field);
            }
            $row.append($fields);
            $('#unique-fields-list').empty().hide();
            $('#response-list').append($row).show();
            for(let i = 0; i < errors.length; i++) {
                if(errors[i].field === "base") {
                    var fieldName = (errors[i].message.indexOf("Display Name") > -1) ? "name" : "asset_tag";
                } else {
                    var fieldName = errors[i].field.split(" ").join('_').toLowerCase();
                }
                var message = errorMessage(errors[i], fieldName);
                var $field = $fields.find('.field input[data-id^='+fieldName+']');
                if($field.length > 0) {
                    var $errorSpan = $("<span class='error-message'>" + message + "</span>");
                    $field.addClass('error');
                    $field.parent('.field').append($errorSpan);
                } else {
                    var $errorSpan = $(`<span class='error-message'>${fieldName.split('_').join(' ').toUpperCase()} - ${message}</span>`);
                    $fields.closest('.field-row').append($errorSpan)
                }
            }
        } else {
            showErrorMessage(client, 'generic')
        }
    }
};

// returns the error message - post api validation
const errorMessage = function(val, field) {
    if(val.message.indexOf("unique") > -1) {
        return `This ${field.split('_').join(' ')} already exists`
    } else if(val.message.indexOf("Has 0 characters") > -1){
        return `Field cannot be blank`;
    } else {
        return val.message;
    }
};
