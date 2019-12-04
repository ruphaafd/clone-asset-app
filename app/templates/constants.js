var CONSTANTS = {
    domainName: "",
    options: {},
    quantity: 1,
    uniqueFields: [
        { label: "Display Name", name: "name", field_type: "default_display_name" },
        { label: "Asset Tag", name: "asset_tag", field_type: "default_asset_tag" }
    ],
    assetList: [],
    response: {
        success: 0,
        error: 0
    },
    control: {},
    asset: {},
    errorsMessages: {
        generic: "Something went wrong. Please try again later",
        quantity: "Enter a valid quantity(limit upto 15)"
    },
    urls: {
        getAsset: "/api/v2/assets/{0}?include=type_fields",
        getAssetTypeFields: "/api/v2/asset_types/{0}/fields",
        createAsset: "/api/v2/assets"
    },
    defaultFilter: {
        Hardware: "Serial Number",
        EBS: "Volume Id",
        EC2: "Instance Id",
        RDS: "Instance Name"
    }
}
