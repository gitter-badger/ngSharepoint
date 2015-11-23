angular
    .module('ngSharepoint', [])
    .run(['$sp', '$spLoader', function($sp, $spLoader) {
        if ($sp.getAutoload()) {
            if ($sp.getConnectionMode() === 'JSOM') {
                var scripts = [
                    '//ajax.aspnetcdn.com/ajax/4.0/1/MicrosoftAjax.js',
                    'SP.Runtime.js',
                    'SP.js'
                ];
                $spLoader.loadScripts('SP.Core', scripts);
            }else if ($sp.getConnectionMode() === 'REST' && !$sp.getAccessToken()) {
                $spLoader.loadScript('SP.RequestExecutor.js');
            }
        }
    }]);

angular
    .module('ngSharepoint')
    .factory('CamlBuilder', ['CamlTag', function(CamlTag) {
        var CamlBuilder = function() {
            this.caml = [];
        };
        CamlBuilder.prototype.push = function(tag, attr, value) {
            var camlTag;
            if (tag instanceof CamlTag) {
                camlTag = tag;
            }else {
                camlTag = new CamlTag(tag, attr, value);
            }
            this.caml.push(camlTag);
            return camlTag;
        };
        CamlBuilder.prototype.findByName = function(name) {
            var result = [];
            this.caml.forEach(function(tag) {
                if (tag.name === name) {
                    result.push(tag);
                }
            });
            return result;
        };
        CamlBuilder.prototype.build = function() {
            for (var i = 0; i < this.caml.length; i++) {
                this.caml[i] = this.caml[i].build();
            }
            return this.caml.join('');
        };
        CamlBuilder.prototype.buildFromJson = function(json) {
            var root = this.findByName('View');
            if (root.length === 0) {
                root = this.push('View');
            }else {
                root = root[0];
            }
            if (angular.isDefined(json.columns)) {
                this.__buildViewFields(json.columns, root);
            }
            if (angular.isDefined(json.query)) {
                this.__buildQuery(json.query, root);
            }
            if (angular.isDefined(json.limit)) {
                this.__buildLimit(json.limit, root);
            }
            if (angular.isDefined(json.order)) {
                this.__buildOrder(json.order, root);
            }
        };
        CamlBuilder.prototype.__buildViewFields = function(columns, root) {
            var viewFields = root.push('ViewFields');
            columns.forEach(function(col) {
                viewFields.push('FieldRef', {Name: col});
            });
        };
        CamlBuilder.prototype.__buildQuery = function(query, root) {
            var builder = this;
            if (root.name === 'View') {
                root = root.push('Query').push('Where');
            }
            if (angular.isDefined(query.concat)) {
                var concatenator;
                if (query.concat === 'and') {
                    concatenator = root.push('And');
                }else if (query.concat === 'or') {
                    concatenator = root.push('Or');
                }else {
                    throw 'Invalid Query';
                }
                query.queries.forEach(function(sub) {
                    builder.__buildQuery(sub, concatenator);
                });
            }else if (angular.isDefined(query.comparator)) {
                query.comparator = query.comparator.toLowerCase();
                var comparator;
                switch (query.comparator) {
                    case 'beginswith':
                        comparator = root.push('BeginsWith');
                        break;
                    case 'contains':
                        comparator = root.push('Contains');
                        break;
                    case 'daterangesoverlap':
                        comparator = root.push('DateRangesOverlap');
                        break;
                    case '==':
                    case 'eq':
                    case 'equals':
                        comparator = root.push('Eq');
                        break;
                    case '>=':
                    case 'geq':
                    case 'greaterequals':
                        comparator = root.push('Geq');
                        break;
                    case '>':
                    case 'gt':
                    case 'greater':
                        comparator = root.push('Gt');
                        break;
                    case 'in':
                        comparator = root.push('In');
                        break;
                    case 'includes':
                        comparator = root.push('Includes');
                        break;
                    case 'isnotnull':
                        comparator = root.push('IsNotNull');
                        break;
                    case 'isnull':
                        comparator = root.push('IsNull');
                        break;
                    case '<=':
                    case 'leq':
                    case 'lessequals':
                        comparator = root.push('Leq');
                        break;
                    case '<':
                    case 'lt':
                    case 'less':
                        comparator = root.push('Lt');
                        break;
                    case '!=':
                    case 'neq':
                    case 'notequals':
                        comparator = root.push('Neq');
                        break;
                    case 'notincludes':
                        comparator = root.push('NotIncludes');
                        break;
                }
                comparator.push('FieldRef', {Name: query.column});
                if (angular.isDefined(query.value)) {
                    comparator.push('Value', {}, query.value);
                }
            }else {
                throw 'Invalid Query';
            }
        };
        CamlBuilder.prototype.__buildLimit = function(limit, root) {
            root.push('RowLimit', {}, limit);
        };
        CamlBuilder.prototype.__buildOrder = function(order, root) {
            var query = root.findByName('Query');
            if (query.length === 0) {
                query = root.push('Query');
            }else {
                query = query[0];
            }
            var orderTag = query.push('OrderBy');
            order.forEach(function(o) {
                if (angular.isDefined(o.column)) {
                    var asc = true;
                    if (angular.isDefined(o.asc)) {
                        asc = o.asc;
                    }
                    asc = asc.toString().toUpperCase();
                    orderTag.push('FieldRef', {Name: o.column, Ascending: asc});
                }else {
                    throw 'Invalid Order Query';
                }
            });
        };
        return (CamlBuilder);
    }]);

angular
    .module('ngSharepoint')
    .factory('$spCamlParser', function() {
        var CamlParser = function(query) {
            var parser = this;
            parser.viewFields = [];
            parser.query = query;
            parser.where = {};
            parser.orderBy = [];
            parser.limit = -1;
            parser.doc = new DOMParser().parseFromString(query, 'text/xml');
            var viewFieldsTags = parser.doc.getElementsByTagName('ViewFields');
            if (viewFieldsTags.length === 1) {
                var fieldTags = viewFieldsTags[0].getElementsByTagName('FieldRef');
                for (var i = 0; i < fieldTags.length; i++) {
                    var field = fieldTags[i];
                    parser.viewFields.push(field.attributes.Name.value);
                }
            }
            var queryTags = parser.doc.getElementsByTagName('Query');
            if (queryTags.length === 1) {
                var queryTag = queryTags[0];
                for (var j = 0; j < queryTag.childNodes.length; j++) {
                    var queryNode = queryTag.childNodes[j];
                    if (queryNode.nodeName === 'Where' || queryNode.nodeName === 'And' || queryNode.nodeName === 'Or') {
                        parser.__parseWhere(queryNode, parser.where);
                    }
                }
            }
            var rowLimitTags = parser.doc.getElementsByTagName('RowLimit');
            if (rowLimitTags.length === 1) {
                parser.limit = parseInt(rowLimitTags[0].childNodes[0].nodeValue);
            }
            return parser;
        };
        CamlParser.prototype.__parseWhere = function(tag, parentObject) {
            var parser = this;
            var obj = {};
            if (tag.nodeName === 'Where') {
                var node = tag.childNodes[0];
                obj.operator = node.nodeName;
                obj.column = node.getElementsByTagName('FieldRef')[0].attributes.Name.value;
                obj.value = node.getElementsByTagName('Value')[0].childNodes[0].nodeValue;
            }else if (tag.nodeName === 'And' || tag.nodeName === 'Or') {
                obj.concat = tag.nodeName;
                obj.queries = [];
                for (var i = 0; i < tag.childNodes.length; i++) {
                    parser.__parseWhere(tag.childNodes[i], obj.queries);
                }
            }
            if (angular.isArray(parentObject)) {
                parentObject.push(obj);
            }else {
                Object.getOwnPropertyNames(obj).forEach(function(param) {
                    parentObject[param] = obj[param];
                });
            }
        };
        CamlParser.prototype.getViewFields = function() {
            return this.viewFields;
        };
        CamlParser.prototype.hasViewFields = function() {
            return this.viewFields.length > 0;
        };
        CamlParser.prototype.getWhere = function() {
            return this.where;
        };
        CamlParser.prototype.hasWhere = function() {
            return (angular.isDefined(this.where) && this.where !== null && Object.getOwnPropertyNames(this.where) > 0);
        };
        CamlParser.prototype.getLimit = function() {
            return this.limit;
        };
        CamlParser.prototype.hasLimit = function() {
            return (angular.isDefined(this.where) && this.limit !== null && !isNaN(this.limit) && this.limit >= 0);
        };
        CamlParser.prototype.getQuery = function() {
            return this.query;
        };
        return ({
            parse: function(query) {
                return new CamlParser(query);
            }
        });
    });

angular
    .module('ngSharepoint')
    .factory('CamlTag', function() {
        var CamlTag = function(name, attr, value) {
            this.name = name;
            this.attr = attr || {};
            this.value = value;
            this.caml = [];
        };
        CamlTag.prototype.__buildTag = function() {
            var tag = this;
            var xml = '<';
            xml += tag.name;
            if (Object.getOwnPropertyNames(tag.attr).length > 0) {
                Object.getOwnPropertyNames(tag.attr).forEach(function(key) {
                    xml += ' ';
                    xml += key;
                    xml += '=';
                    xml += '"' + tag.attr[key] + '"';
                });
            }
            if (this.caml.length === 0 && angular.isUndefined(this.value)) {
                xml += '/>';
            }else {
                xml += '>';
                if (angular.isDefined(this.value)) {
                    xml += this.value;
                }
            }
            return xml;
        };
        CamlTag.prototype.findByName = function(name) {
            var result = [];
            this.caml.forEach(function(tag) {
                if (tag.name === name) {
                    result.push(tag);
                }
            });
            return result;
        };
        CamlTag.prototype.push = function(tag, attr, value) {
            var camlTag;
            if (tag instanceof CamlTag) {
                camlTag = tag;
            }else {
                camlTag = new CamlTag(tag, attr, value);
            }
            this.caml.push(camlTag);
            return camlTag;
        };
        CamlTag.prototype.setValue = function(value) {
            this.value = value;
        };
        CamlTag.prototype.build = function() {
            var query = this.__buildTag();
            for (var i = 0; i < this.caml.length; i++) {
                query += this.caml[i].build();
            }
            if (this.caml.length > 0 || angular.isDefined(this.value)) {
                query += '</' + this.name + '>';
            }
            return query;
        };
        return (CamlTag);
    });

angular
    .module('ngSharepoint')
    .provider('$sp', $spProvider);

function $spProvider() {
    var siteUrl = '';
    var connMode = 'JSOM';
    var token = false;
    var autoload = true;

    var provider = {
        setSiteUrl: setSiteUrl,
        setConnectionMode: setConnectionMode,
        setAccessToken: setAccessToken,
        setAutoload: setAutoload,
        $get: $sp
    };
    return provider;

    function setSiteUrl(newUrl) {
        siteUrl = newUrl;
    }
    function setConnectionMode(newConnMode) { //Only JSOM Supported for now
        if (newConnMode === 'JSOM' || newConnMode === 'REST') {
            connMode = newConnMode;
        }
    }
    function setAccessToken(newToken) {
        token = newToken;
    }
    function setAutoload(newAutoload) {
        autoload = newAutoload;
    }

    function $sp() {
        var service = {
            getSiteUrl: getSiteUrl,
            getConnectionMode: getConnectionMode,
            getAccessToken: getAccessToken,
            getContext: getContext,
            getAutoload: getAutoload
        };
        return service;

        function getContext() {
            return new SP.ClientContext();
        }
        function getSiteUrl() {
            return siteUrl;
        }
        function getConnectionMode() {
            return connMode;
        }
        function getAccessToken() {
            return token;
        }
        function getAutoload() {
            return autoload;
        }
    }
}

angular
    .module('ngSharepoint')
    .factory('$spLoader', ['$q', '$http', '$sp', '$spLog', function($q, $http, $sp, $spLog) {
        var scripts = {};
        var SPLoader = {};
        SPLoader.loadScript = function(lib) {
            var query = $q(function(resolve, reject) {
                var element = document.createElement('script');
                element.type = 'text/javascript';
                if (lib[0] === lib[1] && lib[0] === '/') {
                    element.src = lib;
                }else {
                    element.src = $sp.getSiteUrl() + '_layouts/15/' + lib;
                }
                element.onload = resolve;
                element.onerror = reject;
                document.head.appendChild(element);
            });
            scripts[lib] = query;
            return query;
        };
        SPLoader.loadScripts = function(label, libs) {
            var queries = [];
            libs.forEach(function(lib) {
                queries.push(SPLoader.loadScript(lib));
            });
            var query = $q.all(queries);
            scripts[label] = query;
            return query;
        };
        SPLoader.waitUntil = function(lib) {
            return $q(function(resolve, reject) {
                if (scripts.hasOwnProperty(lib)) {
                    scripts[lib].then(resolve, reject);
                }else if ($sp.getAutoload()) {
                    reject('Library was not requested');
                }else {
                    resolve();
                }
            });
        };
        SPLoader.query = function(queryObject) {
            //TODO: Request the Request Digest in SPContext
            return $q(function(resolve, reject) {
                $http({
                    method: 'POST',
                    url: $sp.getSiteUrl() + '_api/contextInfo',
                    headers: {
                        'X-FORMS_BASED_AUTH_ACCEPTED': 'f',
                        'Accept': 'application/json; odata=verbose',
                        'Content-Type': 'application/json; odata=verbose'
                    }
                }).then(function(data) {
                    var query = {
                        url: $sp.getSiteUrl() + queryObject.url,
                        method: queryObject.method,
                        headers: {
                            //'X-FORMS_BASED_AUTH_ACCEPTED': 'f',
                            'X-RequestDigest': data.d.GetContextWebInformation.FormDigestValue,
                            'Accept': 'application/json; odata=verbose',
                            'Content-Type': 'application/json; odata=verbose'
                        }
                    };
                    if ($sp.getConnectionMode() === 'REST' && !$sp.getAccessToken()) {
                        SPLoader.waitUntil('SP.RequestExecutor.js').then(function() {
                            if (queryObject.hasOwnProperty('data') &&
                                angular.isDefined(queryObject.data) &&
                                queryObject !== null) {
                                query.body = queryObject.data;
                            }
                            query.success = resolve;
                            query.error = reject;
                            new SP.RequestExecutor($sp.getSiteUrl()).executeAsync(query);
                        });
                    }else {
                        if (queryObject.hasOwnProperty('data') &&
                            angular.isDefined(queryObject.data) &&
                            queryObject !== null) {
                            query.data = queryObject.data;
                        }
                        query.headers.Authorization = 'Bearer ' + $sp.getAccessToken();
                        $http(query).then(resolve, reject);
                    }
                });
            }).catch($spLog.error);
        };
        return (SPLoader);
    }]);

angular
    .module('ngSharepoint')
    .provider('$spLog', function() {
        var prefix = '[ngSharepoint] ';
        var enabled = true;
        return {
            setPrefix: function(prefix) {
                this.prefix = '[' + prefix + '] ';
            },
            setEnabled: function(enabled) {
                this.enabled = enabled;
            },
            $get: function() {
                return ({
                    error: function(msg) {
                        if (enabled) {
                            if (angular.isObject(msg)) {
                                console.error(prefix + 'Object: %O', msg);
                            }else {
                                console.error(prefix + msg);
                            }
                        }
                    },
                    warn: function(msg) {
                        if (enabled) {
                            if (angular.isObject(msg)) {
                                console.warn(prefix + 'Object: %O', msg);
                            }else {
                                console.warn(prefix + msg);
                            }
                        }
                    },
                    log: function(msg) {
                        if (enabled) {
                            if (angular.isObject(msg)) {
                                console.log(prefix + 'Object: %O', msg);
                            }else {
                                console.log(prefix + msg);
                            }
                        }
                    }
                });
            }
        };
    });

angular
    .module('ngSharepoint.Lists', ['ngSharepoint']);

angular
    .module('ngSharepoint.Lists')
    .factory('JSOMConnector', ['$q', '$sp', function($q, $sp) {
        return ({
            getLists: function() {
                return $q(function(resolve, reject) {
                    var context = $sp.getContext();
                    var lists = context.get_web().get_lists();
                    context.load(lists);
                    context.executeQueryAsync(function() {
                        var result = [];
                        var listEnumerator = lists.getEnumerator();
                        while (listEnumerator.moveNext()) {
                            var list = listEnumerator.get_current();
                            result.push(list);
                        }
                        resolve(result);
                    }, reject);
                });
            }
        });
    }]);

angular
    .module('ngSharepoint.Lists')
    .factory('RESTConnector', ['$q', '$sp', '$spLoader', function($q, $sp, $spLoader) {
        return ({
            getLists: function() {
                return $q(function(resolve, reject) {

                });
            }
        });
    }]);

angular
    .module('ngSharepoint.Lists')
    .factory('JsomSPList', ['$q', '$sp', '$spLoader', '$spCamlParser', function($q, $sp, $spLoader, $spCamlParser) {
        var JsomSPList = function(title) {
            this.title = title;
        };
        JsomSPList.prototype.getGUID = function() {
            var that = this;
            return $q(function(resolve, reject) {
                $spLoader.waitUntil('SP.Core').then(function() {
                    var context = $sp.getContext();
                    var list = context.get_web().get_lists().getByTitle(that.title);
                    context.load(list);
                    context.executeQueryAsync(function() {
                        resolve(list.get_id().toString());
                    }, reject);
                });
            });
        };
        JsomSPList.prototype.readColumns = function(query) {
            var that = this;
            return $q(function(resolve, reject) {
                var columns = $spCamlParser.parse(query).getViewFields();
                if (columns.length <= 0) {
                    $spLoader.waitUntil('SP.Core').then(function() {
                        var context = $sp.getContext();
                        var list = context.get_web().get_lists().getByTitle(that.title);
                        var fields = list.get_fields();
                        context.load(fields, 'Include(Title)');
                        context.executeQueryAsync(function() {
                            var itemIterator = fields.getEnumerator();
                            while (itemIterator.moveNext()) {
                                var field = itemIterator.get_current();
                                if (field.get_title() !== 'BDC Identity') { //TODO: Make configurable
                                    columns.push(field.get_title());
                                }
                            }
                            resolve(columns);
                        }, reject);
                    }, reject);
                }else {
                    resolve(columns);
                }
            });
        };
        JsomSPList.prototype.read = function(query, serializer) {
            var that = this;
            return $q(function(resolve, reject) {
                that.readColumns(query).then(function(columns) {
                    $spLoader.waitUntil('SP.Core').then(function() {
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
                                result.push(that.__unpack(item, columns, serializer));
                            }
                            resolve(result);
                        }, function(sender, args) {
                            reject(args);
                        });
                    }, reject);
                });
            });
        };
        JsomSPList.prototype.create = function(data, serializer) {
            var that = this;
            return $q(function(resolve, reject) {
                $spLoader.waitUntil('SP.Core').then(function() {
                    var clientContext = $sp.getContext();
                    var list = clientContext.get_web().get_lists().getByTitle(that.title);
                    var itemInfo = new SP.ListItemCreationInformation();
                    var item = list.addItem(itemInfo);
                    that.__pack(item, data, serializer);
                    item.update();
                    clientContext.load(item);
                    clientContext.executeQueryAsync(function() {
                        resolve(data);
                    }, function(sender, args) {
                        reject(args);
                    });
                });
            });
        };
        JsomSPList.prototype.delete = function(query) {
            var that = this;
            return $q(function(resolve, reject) {
                $spLoader.waitUntil('SP.Core').then(function() {
                    var clientContext = $sp.getContext();
                    var list = clientContext.get_web().get_lists().getByTitle(that.title);
                    var camlQuery = new SP.CamlQuery();
                    camlQuery.set_viewXml(query);
                    var items = list.getItems(camlQuery);
                    clientContext.load(items);
                    clientContext.executeQueryAsync(function() {
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
                    });
                });
            });
        };
        JsomSPList.prototype.update = function(query, data, serializer) {
            var that = this;
            return $q(function(resolve, reject) {
                $spLoader.waitUntil('SP.Core').then(function() {
                    var clientContext = $sp.getContext();
                    var list = clientContext.get_web().get_lists().getByTitle(that.title);
                    var camlQuery = new SP.CamlQuery();
                    camlQuery.set_viewXml(query);
                    var items = list.getItems(camlQuery);
                    clientContext.load(items);
                    clientContext.executeQueryAsync(function() {
                        var itemIterator = items.getEnumerator();
                        while (itemIterator.moveNext()) {
                            var item = itemIterator.get_current();
                            that.__pack(item, data, serializer);
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
            });
        };
        JsomSPList.prototype.__pack = function(item, data, serializer) {
            if (angular.isDefined(serializer)) {
                data = serializer.__serialize();
            }
            Object.getOwnPropertyNames(data).forEach(function(key) {
                var value = data[key];
                if (angular.isDefined(value) && value !== null && angular.isString(value)) {
                    value = value.trim();
                }
                item.set_item(key, value);
            });
        };
        JsomSPList.prototype.__unpack = function(item, cols, serializer) {
            var obj = {};
            if (!angular.isArray(cols)) {
                cols = Object.getOwnPropertyNames(cols);
            }
            cols.forEach(function(key) {
                var value = item.get_item(key);
                if (angular.isDefined(value) && value !== null && angular.isString(value)) {
                    value = value.trim();
                }
                obj[key] = value;
            });
            if (angular.isDefined(serializer)) {
                return serializer.__deserialize(obj);
            }
            return obj;
        };
        return (JsomSPList);
    }]);

angular
    .module('ngSharepoint.Lists')
    .factory('RestSPList', ['$q', '$sp', '$spLoader', function($q, $sp, $spLoader) {
        var RestSPList = function(title) {
            this.title = title;
        };
        RestSPList.prototype.read = function(query) {
            var endpoint = '_api/web/Lists/GetByTitle(\'' + this.title + '\')/GetItems';
            var body = {
                query: {
                    __metadata: {
                        type: 'SP.CamlQuery'
                    },
                    ViewXml: query
                }
            };
            return $q(function(resolve, reject) {
                $spLoader.query({
                    method: 'POST',
                    url: endpoint,
                    data: body
                }).then(function(data) {
                    //TODO: Parse Result
                }, reject);
            });
        };
        RestSPList.prototype.create = function(data) {
            var endpoint = '_api/web/Lists/GetByTitle(\'' + this.title + '\')/items';
            var body = {
                __metadata: {
                    type: 'SP.Data.TestListItem'
                }
            };
            Object.getOwnPropertyNames(data).forEach(function(key) {
                var value = data[key];
                if (angular.isDefined(value) && value !== null && angular.isString(value)) {
                    value = value.trim();
                }
                body[key] = value;
            });
            return $q(function(resolve, reject) {
                $spLoader.query({
                    method: 'POST',
                    url: endpoint,
                    data: body
                }).then(function(data) {
                    //TODO: Parse Result
                }, reject);
            });
        };
        RestSPList.prototype.delete = function(query) {
            //TODO: Implement
        };
        RestSPList.prototype.update = function(query, data) {
            //TODO: Implement
        };
        return (RestSPList);
    }]);

angular
    .module('ngSharepoint.Lists')
    .factory('SPList', ['$sp', '$spLog', 'CamlBuilder', 'RestSPList', 'JsomSPList', function($sp, $spLog, CamlBuilder, RestSPList, JsomSPList) {
        //TODO: Add all List APIs
        /**
        * @ngdoc object
        * @name  SPList
        * @param {string} title The List Title
        *
        * @module  ngSharepoint.Lists
        *
        * @description
        * SPList represents a Sharepoint List
        */
        var SPList = function(title) {
            this.title = title;
            if ($sp.getConnectionMode() === 'JSOM') {
                this.__list = new JsomSPList(title);
            }else {
                this.__list = new RestSPList(title);
            }
        };

        SPList.prototype.getGUID = function() {
            return this.__list.getGUID().catch($spLog.error);
        };

        SPList.prototype.getTitle = function() {
            return this.__list.getTitle().catch($spLog.error);
        };

        SPList.prototype.setTitle = function(title) {
            return this.__list.setTitle(title).catch($spLog.error);
        };

        SPList.prototype.getDescription = function() {
            return this.__list.getDescription().catch($spLog.error);
        };

        SPList.prototype.setDescription = function(desc) {
            return this.__list.setDescription(desc).catch($spLog.error);
        };
        /**
        * @ngdoc function
        * @name  SPList#create
        * @param  {object} data The Data you wanna create
        * @return {Promise}      A Promise which resolves when the insertion was sucessful
        */
        SPList.prototype.create = function(data, serializer) {
            return this.__list.create(data, serializer).catch($spLog.error);
        };
        /**
        * @ngdoc function
        * @name  SPList#read
        * @param {string} query A CamlQuery to filter for
        * @return {Promise} A Promise which resolves to the selected data
        */
        SPList.prototype.read = function(query, serializer) {
            return this.__list.read(query, serializer).catch($spLog.error);
        };
        /**
        * @ngdoc function
        * @param  {string} query  A CamlQuery which selects the rows to update
        * @param  {object} data The Data you wanna update
        * @return {Promise}        A Promise which resolves when the update was sucessfull
        */
        SPList.prototype.update = function(query, data, serializer) {
            return this.__list.update(query, data, serializer).catch($spLog.error);
        };
        /**
        * @ngdoc function
        * @param  {string} query A CamlQuery to filter for
        * @return {Promise}       [description]
        */
        SPList.prototype.delete = function(query) {
            return this.__list.delete(query).catch($spLog.error);
        };
        /**
         * @ngdoc function
         * @param  {object} query [description]
         * @return {Promise}       [description]
         */
        SPList.prototype.query = function(query) {
            if (angular.isObject(query)) {
                return this.__jsonQuery(query);
            }
        };
        SPList.prototype.__jsonQuery = function(query) {
            if (angular.isDefined(query.type)) {
                var builder = new CamlBuilder();
                builder.buildFromJson(query);
                switch (query.type) {
                    case 'create':
                        if (angular.isDefined(query.data)) {
                            return this.create(query.data, query.serializer);
                        }else {
                            throw 'Query Data is not defined';
                        }
                        break;
                    case 'read':
                        return this.read(builder.build(), query.serializer);
                    case 'update':
                        if (angular.isDefined(query.data)) {
                            return this.update(builder.build(), query.data, query.serializer);
                        }else {
                            throw 'Query Data is not defined';
                        }
                        break;
                    case 'delete':
                        return this.delete(builder.build());
                }
            }else {
                throw 'Query Type is not defined';
            }
        };
        return (SPList);
    }]);

angular
    .module('ngSharepoint.Lists')
    .factory('$query', $query);

function $query($spList) {
    var Query = function() {
        this.columns = [];
        this.list = undefined;
        this.__type = undefined;
        this.__query = undefined;
        this.__limit = undefined;
        this.__serializer = undefined;
        this.__order = [];
        this.__data = {};
        this.read = function(cols) {
            if (angular.isUndefined(this.type)) {
                this.columns = cols;
                this.type = 'read';
            }else {
                throw 'Cannot use read after another query type was selected';
            }
            return this;
        };
        this.create = function(data) {
            if (angular.isUndefined(this.type)) {
                this.type = 'create';
                if (angular.isDefined(data)) {
                    this.data = data;
                }
            }else {
                throw 'Cannot use create after another query type was selected';
            }
            return this;
        };
        this.from = function(list) {
            this.list = list;
            return this;
        };
        this.in = function(list) {
            this.list = list;
            return this;
        };
        this.list = function(list) {
            this.list = list;
            return this;
        };
        this.update = function(data) {
            if (angular.isUndefined(this.type)) {
                this.type = 'update';
                if (angular.isDefined(data)) {
                    this.data = data;
                }
            }else {
                throw 'Cannot use update after another query type was selected';
            }
            return this;
        };
        this.delete = function() {
            if (angular.isUndefined(this.type)) {
                this.type = 'delete';
            }else {
                throw 'Cannot use delete after another query type was selected';
            }
            return this;
        };
        this.where = function(col) {
            var Where = function(col, instance) {
                this.equals = function(value) {
                    instance.query = {
                        comparator: 'equals',
                        column: col,
                        value: value
                    };
                    return instance;
                };
                this.greater = function(value) {
                    instance.query = {
                        comparator: 'greater',
                        column: col,
                        value: value
                    };
                    return instance;
                };
                this.smaller = function(value) {
                    instance.query = {
                        comparator: 'smaller',
                        column: col,
                        value: value
                    };
                    return instance;
                };
            };
            return new Where(col, this);
        };
        this.set = function(column, value) {
            this.data[column] = value;
            return this;
        };
        this.value = function(column, value) {
            this.data[column] = value;
            return this;
        };
        this.class = function(serializer) {
            this.serializer = serializer;
            return this;
        };
        this.orderBy = function(field, asc) {
            if (angular.isUndefined(asc)) {
                asc = true;
            }
            this.order.push({column: field, asc: asc});
            return this;
        };
        this.limit = function(limit) {
            this.limit = limit;
            return this;
        };
        this.exec = function() {
            return $spList.getList(this.list).query({
                type: this.__type,
                query: this.__query,
                limit: this.__limit,
                serializer: this.__serializer,
                order: this.__order,
                data: this.__data
            });
        };
        this.then = function(resolve, reject) {
            return this.exec().then(resolve, reject);
        };
    };
    return ({ //TODO: Reimplement this nested return mess
        'create': function(data) {
            return new Query().create(data);
        },
        'read': function(cols) {
            return new Query().read(cols);
        },
        'update': function(data) {
            return new Query().update(data);
        },
        'delete': function() {
            return new Query().delete();
        }
    });
}
$query.$inject = ['$spList'];

angular
    .module('ngSharepoint.Lists')
    .factory('$spList', $spList);

function $spList ($sp, SPList, JSOMConnector, RESTConnector) {
    var service = {
        getList: getList,
        getLists: getLists
    };

    return service;

    function getList(title) {
        return new SPList(title);
    }
    function getLists() {
        var promise;
        if ($sp.getConnectionMode() === 'JSOM') {
            promise = JSOMConnector.getLists();
        }else {
            promise = RESTConnector.getLists();
        }
        return promise.then(function(listNames) {
            var lists = [];
            listNames.forEach(function(name) {
                lists.push(new SPList(name));
            });
            return lists;
        });
    }
}
$spList.$inject = ['$sp', 'SPList', 'JSOMConnector', 'RESTConnector'];

angular
    .module('ngSharepoint.Users', ['ngSharepoint'])
    .run(['$sp', '$spLoader', function($sp, $spLoader) {
        if ($sp.getAutoload()) {
            if ($sp.getConnectionMode() === 'JSOM') {
                $spLoader.loadScript('SP.Userprofiles.js');
            }
        }
    }]);

angular
    .module('ngSharepoint.Users')
    .factory('JsomSPUser', ['$q', '$sp', '$spLoader', function($q, $sp, $spLoader) {
        var JsomSPUser = function(accountName) {
            this.accountName = accountName;
        };
        JsomSPUser.prototype.load = function() {
            var user = this;
            return $q(function(resolve, reject) {
                $spLoader.waitUntil('SP.Userprofiles.js').then(function() {
                    var context = $sp.getContext();
                    var peopleManager = new SP.UserProfiles.PeopleManager(context);
                    var properties = peopleManager.getPropertiesFor(user.accountName);
                    context.load(properties);
                    context.executeQueryAsync(function() {
                        var data = {};
                        data.displayName = properties.get_displayName();
                        data.email = properties.get_email();
                        data.picture = properties.get_pictureUrl();
                        data.title = properties.get_title();
                        data.personalUrl = properties.get_personalUrl();
                        data.userUrl = properties.get_userUrl();
                        resolve(data);
                    }, reject);
                });
            });
        };
        return (JsomSPUser);
    }]);

angular
    .module('ngSharepoint.Users')
    .factory('RestSPUser', ['$q', '$spLoader', function($q, $spLoader) {
        var RestSPUser = function(accountName) {
            this.accountName = accountName;
        };
        RestSPUser.prototype.load = function() {
            var user = this;
            var endpoint = '_api/SP.UserProfiles.PeopleManager/getPropertiesFor(@account)' +
                '?@account=\'' + user.accountName + '\'';
            return $q(function(resolve, reject) {
                $spLoader({
                    method: 'GET',
                    url: endpoint
                }).then(function(response) {
                    var data = {};
                    data.displayName = response.d.DisplayName;
                    data.email = response.d.Email;
                    data.picture = response.d.PictureUrl;
                    data.title = response.d.Title;
                    data.personalUrl = response.d.PersonalUrl;
                    data.userUrl = response.d.UserUrl;
                    resolve(data);
                }, reject);
            });
        };
        return (RestSPUser);
    }]);

angular
    .module('ngSharepoint.Users')
    .factory('SPUser', ['$q', '$spLoader', '$sp', 'JsomSPUser', 'RestSPUser', function($q, $spLoader, $sp, JsomSPUser, RestSPUser) {
        var SPUser = function(accountName, load) {
            var user = this;
            if (angular.isUndefined(load)) {
                load = true;
            }
            user.accountName = accountName;
            if ($sp.getConnectionMode() === 'JSOM') {
                user.__user = new JsomSPUser(accountName);
            }else {
                user.__user = new RestSPUser(accountName);
            }
            if (load) {
                return user.load().then(function(data) {
                    user.from(data);
                });
            }else {
                return user;
            }
        };
        SPUser.prototype.from = function(data) {
            this.displayName = data.displayName;
            this.email = data.email;
            this.picture = data.picture;
            this.title = data.title;
            this.personalUrl = data.personalUrl;
            this.userUrl = data.userUrl;
            this.properties = data.properties;
        };
        SPUser.prototype.load = function() {
            return this.__user.load();
        };
        return (SPUser);
    }]);

angular
    .module('ngSharepoint.Users')
    .factory('$spUser', ['$q', '$sp', 'SPUser', function($q, $sp, SPUser) {
        return ({
            getCurrentUser: function() {
                //TODO: Abstract with SPUser
                return $q(function(resolve, reject) {
                    var context = $sp.getContext();
                    var peopleManager = new SP.UserProfiles.PeopleManager(context);
                    var properties = peopleManager.getMyProperties();
                    context.load(properties);
                    context.executeQueryAsync(function() {
                        resolve(properties);
                    }, reject);
                });
            },
            getUser: function(accountName) {
                return new SPUser(accountName);
            }
        });
    }]);
