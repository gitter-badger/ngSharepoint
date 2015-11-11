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
			this.caml.forEach(function(caml) {
				if (caml.name === name) {
					result.push(caml);
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
		return (CamlBuilder);
	}]);