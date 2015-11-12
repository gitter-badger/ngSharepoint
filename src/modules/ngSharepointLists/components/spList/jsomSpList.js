angular
    .module('ngSharepoint.Lists')
    .factory('JsomSPList', ['$q', '$sp', function($q, $sp) {
        var JsomSPList = function(title) {
            this.title = title;
        };
        JsomSPList.prototype.select = function(query) {
            var that = this;
            return $q(function(resolve, reject) {
                var context = $sp.getContext();
                var list = context.get_web().get_lists().getByTitle(that.title);
                var camlQuery = new SP.CamlQuery();
                camlQuery.set_viewXml(query);
                var items = list.getItems(camlQuery);
                context.load(items);
                context.executeQueryAsync(function() {
                    var result = [];
                    var itemIterator = items.getEnumerator();
                    while (itemIterator.moveNext()) {
                        var item = itemIterator.get_current();
                        result.push(list.__unpack(item, $spCamlParser.parse(query).getViewFields()));
                    }
                    resolve(result);
                }, function(sender, args) {
                    reject(args);
                });
            });
        };
        JsomSPList.prototype.insert = function(data) {
            var that = this;
            return $q(function(resolve, reject) {
                var clientContext = $sp.getContext();
                var list = clientContext.get_web().get_lists().getByTitle(that.title);
                var itemInfo = new SP.ListItemCreationInformation();
                var item = list.addItem(itemInfo);
                list.__pack(item, data);
                item.update();
                clientContext.load(item);
                clientContext.executeQueryAsync(function(sender, args) {
                    resolve(data);
                }, function(sender, args) {
                    reject(args);
                });
            });
        };
        JsomSPList.prototype.delete = function(query) {
            var that = this;
            return $q(function(resolve, reject) {
                var clientContext = $sp.getContext();
                var list = clientContext.get_web().get_lists().getByTitle(that.title);
                var camlQuery = new SP.CamlQuery();
                camlQuery.set_viewXml(query);
                var items = list.getItems(camlQuery);
                clientContext.load(items);
                clientContext.executeQueryAsync(
                    function(sender, args) {
                        var itemIterator = items.getEnumerator();
                        var a = [];
                        while (itemIterator.moveNext()) {
                            var item = itemIterator.get_current();
                            a.push(item);
                        }
                        a.forEach(function(item) {
                            item.deleteObject();
                        });
                        clientContext.executeQueryAsync(function(sender, args) {
                            resolve(args);
                        }, function(sender, args) {
                            reject(args);
                        });
                    },
                    function(sender, args) {
                        reject(args);
                    }
                );
            });
        };
        JsomSPList.prototype.update = function(query, data) {
            var list = this;
            return $q(function(resolve, reject) {
                var clientContext = $sp.getContext();
                var list = clientContext.get_web().get_lists().getByTitle(query.__list);
                var camlQuery = new SP.CamlQuery();
                camlQuery.set_viewXml(query);
                var items = list.getItems(camlQuery);
                clientContext.load(items);
                clientContext.executeQueryAsync(function(sender, args) {
                    var itemIterator = items.getEnumerator();
                    while (itemIterator.moveNext()) {
                        var item = itemIterator.get_current();
                        list.__pack(item, data);
                        item.update();
                    }
                    clientContext.executeQueryAsync(function(sender, args) {
                            resolve(args);
                    }, function(sender, args) {
                            reject(args);
                    });
                }, function(sender, args) {
                        reject(args);
                });
            });
        };
        JsomSPList.prototype.__pack = function(item, data) {
            Object.getOwnPropertyNames(data).forEach(function(key) {
                var value = data[key];
                if (value !== null && value !== undefined && typeof value === 'string') {
                    value = value.trim();
                }
                item.set_item(key, value);
            });
        };
        JsomSPList.prototype.__unpack = function(item, fields) {
            var query = this;
            var obj = {};
            var cols = fields;
            if (!Array.isArray(fields)) {
                cols = Object.getOwnPropertyNames(fields);
            }
            cols.forEach(function(key) {
                    var value = item.get_item(key);
                    if (value !== null && value !== undefined && typeof value === 'string') {
                        value = value.trim();
                    }
                    obj[key] = value;
            });                
            return obj;
        };
        return (JsomSPList);
    }]);