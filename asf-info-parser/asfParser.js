///http://msdn.microsoft.com/en-us/library/bb643323.aspx 10.2 for asf guids the super non intuitive guid to hex is below
'use strict';
var inherits = require('util').inherits
  , binary = require('../binaryHelpers')
  , Tokenizr = require('../tokenStream')
  , _ = require('lodash');

var enc = 'utf16'
  , magicWord =       toBuffer('75B22630-668E-11CF-A6D9-00AA0062CE6C')
  , guids = {
          fileProp:   toBuffer('8CABDCA1-A947-11CF-8EE4-00C00C205365')
        , content:    toBuffer('75B22633-668E-11CF-A6D9-00AA0062CE6C')
        , xcontent:   toBuffer('D2D0A440-E307-11D2-97F0-00A0C95EA850')
        , metaData:   toBuffer('C5F8CBEA-5BAF-4877-8467-AA8C44FA4CCA')
        , library:    toBuffer('44231C94-9498-49D1-A141-1D134E457054')
        , dataObject: toBuffer('75B22636-668E-11CF-A6D9-00AA0062CE6C') //first non header
    }


var getStr = _.partialRight(binary.decodeString, enc)
  , valueParser = [
        getStr,
        function(b){ },
        function(b){ return b.readUInt32LE(0) === 1},
        function(b){ return b.readUInt32LE(0) },
        function(b){ return b.readUInt32LE(0) }, //64int
        function(b){ return b.readUInt16LE(0) },

        getStr,
        function(){},
        function(b){ return b.readUInt16LE(0) === 1},
        function(b){ return b.readUInt32LE(0) },
        function(b){ return b.readUInt32LE(0) },
        function(b){ return b.readInt8(0) },
        toGuid,
    ]

function AsfParser(){
    var self = this;

    if ( !(self instanceof AsfParser) ) 
        return new AsfParser();

    Tokenizr.call(this, { objectMode: true })

    this.tags   = {}

    self._headersleft = 5; //short circut

    this.isEqual(magicWord, 'not an asf file')
        .skip(14)
        .loop(function( end){

            this.skipUntil( 16, self.isHeaderGuid, self )
                .skip(24)
                .tap(this.parseHeader)
                .tap(function(){
                    this._headersleft <= 0 && end()
                })
        })
        .tap(function(){
            this.push(null)  
        })
}


inherits(AsfParser, Tokenizr);

AsfParser.prototype.parseHeader = function(){
    switch (this._current) {
        case 'fileProp':
            this._props()
            break;
        case 'content':
            this._content()
            break;
        case 'metaData':
        case 'library':
            this.parseAttributes()
            break;
        case 'xcontent':
            this.parseDescriptors()
            break;
        case 'dataObject':
            return this._headersleft = 0;
    }
    this._headersleft--
}

AsfParser.prototype._content = function(){

    this.readUInt16LE('title_len')
        .readUInt16LE('author_len')
        .readUInt16LE('copyright_len')
        .readUInt16LE('desc_len')
        .readUInt16LE('rating_len')
        .readString('title_len',     enc, 'title')
        .readString('author_len',    enc, 'author')
        .readString('copyright_len', enc, 'copyright')
        .readString('desc_len',      enc, 'desc')
        .readString('rating_len',    enc, 'rating')
        .tap(function(tok){
            var self = this;
            _.each(['title', 'author', 'copyright', 'desc', 'rating'], function(i){
                if ( tok[i] != null ) 
                    self.pushToken(i, clean(tok[i]))
            })
        })
        .flush();
}

AsfParser.prototype._props = function(chain){
    this.skip(40)
        .readUInt32LE('length')
        .skip(12)               //stream duration and last 4 bytes of length
        .readUInt32LE('preroll')
        .tap(function(tok){
            var dur = tok.length / 10000000 - tok.preroll / 1000 //ref taglib again for this one

            this.pushToken('duration', dur ) 
        })
        .flush();
}

AsfParser.prototype.parseDescriptors = function(){

    this.readUInt16LE('tag_count')
        .loop(function(end){
            this.readUInt16LE('name_len')
                .readString('name_len', enc, 'name')
                .readUInt16LE('val_dataType')
                .readUInt16LE('val_len')
                .readBuffer('val_len', 'value')
                .tap(function(tok){
                    if ( tok.name && tok.value ) this.pushToken(tok.name, clean(valueParser[tok.val_dataType](tok.value)) );
                    if ( --tok.tag_count === 0) end()
                })
        })
        .flush()
}

AsfParser.prototype.parseAttributes = function(){

    this.readUInt16LE('tag_count')
        .loop(function(end){
            this.skip(4)
                .readUInt16LE('name_len')
                .readUInt16LE('val_dataType')
                .readUInt32LE('val_len')
                .readString('name_len', enc, 'name')
                .readBuffer('val_len', 'value')
                .tap(function(tok){
                    if ( tok.name && tok.value ) this.pushToken(tok.name, clean(valueParser[tok.val_dataType + 5](tok.value)) );
                    if ( --tok.tag_count === 0) end()
                })
        })
        .flush()
}

AsfParser.prototype.pushToken = function(key, value){
    this.push({ 
        type: key, 
        value: value 
    });
}

AsfParser.prototype.isHeaderGuid = function(hdr){
    var self = this;

    return _.any(guids, function(b, key){
        if( binary.bufferEqual(hdr, b)) 
            return self._current = key 
          
        return false;
    });
}

function clean(str){
    if ( typeof str === 'string' )
        return str.replace(/^\x00+/g, '').replace(/\x00+$/g, '');    

    return str;
}

function toBuffer(guid){
    var words = guid.split('-')
      , string = '';

    _.each(words, function(word, idx){        
          string += idx <= 2 
            ? word.match(/.{2}/g).reverse().join('')
            : word;
    })

    return new Buffer(string, 'hex');
}

function toGuid(buffer){
    var str = buffer.toString('hex')
      , guid = (str.slice(6, 8));

    guid += (str.slice(4, 6));
    guid += (str.slice(2, 4));
    guid += (str.slice(0, 2));
    guid += (str.slice(10, 12));
    guid += (str.slice(8, 10));
    guid += (str.slice(14, 16));
    guid += (str.slice(12, 14));
    guid += (str.slice(16, 34));

    return "{" + (guid.slice(0, 8)) + "-" + (guid.slice(8, 12)) + "-" + (guid.slice(12, 16)) + "-" + (guid.slice(16, 20)) + "-" + (guid.slice(20, 34)) + "}";
}

module.exports = AsfParser;

module.exports.toBuffer = toBuffer

module.exports.toGuid = toGuid;