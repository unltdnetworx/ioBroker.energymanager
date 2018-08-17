/**
 *
 * energymanager adapter
 *
 */

'use strict';

const utils = require(__dirname + '/lib/utils');
var request = require('request');
var systemLanguage;
var nameTranslation;

const adapter = new utils.Adapter('energymanager');

adapter.on('ready', function () {
    adapter.getForeignObject('system.config', function (err, obj) {
        if (err) {
            adapter.log.error(err);
            return;
        } else if (obj) {
            if (!obj.common.language) {
                adapter.log.info("Language not set. English set therefore.");
                nameTranslation = require(__dirname + '/admin/i18n/en/translations.json')
            } else {
                systemLanguage = obj.common.language;
                nameTranslation = require(__dirname + '/admin/i18n/' + systemLanguage + '/translations.json')
            }
            main();
        }
    });
    
});

function translateName(strName) {
    if(nameTranslation[strName]) {
        return nameTranslation[strName];
    } else {
        return strName;
    }
}

function main() {

    var managerAddress = adapter.config.managerAddress
    var valTagLang;

    request(
        {
            url: "http://" + managerAddress + "/rest/kiwigrid/wizard/devices",
            json: true
        },
        function(error, response, content) {

            if (!error && response.statusCode == 200) {
                
                for (var i in content.result.items) {

                    for (var j in content.result.items[i].tagValues) {
                        
                        var valValue = content.result.items[i].tagValues[j].value;
                        valTagLang = translateName(content.result.items[i].tagValues[j].tagName);
                        var valType = typeof valValue;
                        var valTag = content.result.items[i].tagValues[j].tagName;
                        var strGroup;
                        
                        switch (valType) {
                            case "boolean":
                                var valRole = 'indicator.working';
                                break;
                            
                            case "number":
                                if (valTag.search('Date') > -1){
                                    var valRole = 'value.datetime';
                                    valValue = new Date(valValue);
                                    break;
                                }
                                if (valTag.search('StateOfCharge') == 0){
                                    var valRole = 'value.battery';
                                    break;
                                }
                                if (valTag.search('PowerConsum') == 0 || valTag.search('Work') == 0){
                                    var valRole = 'value.power.consumption';
                                    break;
                                }
                                if (valTag.search('Temperature') == 0){
                                    var valRole = 'value.temperature';
                                    break;
                                }
                                if (valTag.search('Min') > -1 && valTag.search('Minute') == -1){
                                    var valRole = 'value.min';
                                    break;
                                }
                                if (valTag.search('Max') > -1){
                                    var valRole = 'value.max';
                                    break;
                                }
                                var valRole = 'value';
                                break;
                            
                            case "string":
                                var valRole = 'text';
                                break;

                            default:
                                var valRole = 'state';
                                break;
                        }

                        if (valValue != null && valType != 'object') {

                            switch(content.result.items[i].deviceModel[1].deviceClass) {
                                case "com.kiwigrid.devices.inverter.Inverter":
                                    strGroup=content.result.items[i].deviceModel[2].deviceClass.split(".").pop();
                                break;
                
                                case "com.kiwigrid.devices.powermeter.PowerMeter":
                                    strGroup=content.result.items[i].deviceModel[2].deviceClass.split(".").pop();
                                break;
                
                                default:
                                    strGroup=content.result.items[i].deviceModel[1].deviceClass.split(".").pop();
                                break;
                            }

                            adapter.setObjectNotExists(
                                strGroup + "." + valTag, {
                                    type: 'state',
                                    common: {
                                        name: valTagLang,
                                        type: valType,
                                        role: valRole
                                    },
                                    native: {}
                                },
                                adapter.setState(
                                    strGroup + "." + valTag,
                                    {val: valValue, ack: true}
                                )
                            );

                        }
                        
                    }
                }
                adapter.stop();

            } else {
                adapter.log.error(error);
                adapter.stop();
            }
        }

    )
}
