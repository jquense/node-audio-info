var inherits = require('util').inherits
  , Tokenizr = require('../tokenStream')
  , binary = require('../binaryHelpers')
  , _ = require('lodash')
  , debug = require('debuglog')('vorbisparser');


module.exports = VorbisParser;

inherits(VorbisParser, Tokenizr);

function VorbisParser(opts){
    if ( !(this instanceof VorbisParser) ) 
        return new VorbisParser();

    opts = _.extend({}, opts || {}, { objectMode: true })

    Tokenizr.call(this, opts)
    
    this.framingBit = typeof opts.framingBit !== 'boolean' 
        ? true 
        : opts.framingBit

    this.loop(function(end){
        this.readUInt8('headerType')
            .isEqual(new Buffer('vorbis', 'utf8'), 'not a valid vorbis Stream')
            .tap(function(tok){
                var headerType = tok.headerType;

                if ( headerType === HEADER_TYPES.INFO ) 
                    this.parseInfoHeader()
                else if ( headerType === HEADER_TYPES.COMMENT ) //comments
                    this.parseVorbisComments()
                else{
                    this.push(null)
                    return end();    
                }
            })
            .flush()
    })
    
}

VorbisParser.prototype.parseInfoHeader = function(){
    this.readUInt32LE('version')
        .readUInt8('channels')
        .readUInt32LE('sampleRate')
        .readUInt32LE('bitRateMax')
        .readUInt32LE('bitRateNominal')
        .readUInt32LE('bitRateMin')
        .tap(function(tok){
            var self = this;

            _.each(_.pick(tok, 'sampleRate', 'bitRateMax','bitRateNominal','bitRateMin'), function(v, key){
                self.push({ type: key, value: v })     
            })       
        })
        .skip(2)
}

//i'd like to once again thank taglib for guidance on parsing these correctly...
VorbisParser.prototype.parseVorbisComments = function(){
    var i = 0;

    this.readUInt32LE('vendorLen')
        .readString('vendorLen', 'utf8', 'venderStr')
        .readUInt32LE('commentCount')
        .loop(function(end, tok){
            if ( i++ === tok.commentCount) 
                this.push(null);
    
            this.readUInt32LE('cLen')
                .readString('cLen', 'utf8', function(str){
                    var idx   = str.indexOf('=')
                      , value = str.slice(idx + 1);

                    str = str.slice(0, idx)

                    value = str === 'METADATA_BLOCK_PICTURE' 
                        ? VorbisParser.parsePicture(new Buffer(value, 'base64'))
                        : value;

                    this.push({ 
                        type:  str, 
                        value: value
                    })
                })
        })
        .tap(function(){
            if ( this.framingBit ) this.skip(1)   
        });
}

VorbisParser.parsePicture = function(buf){
    var pos = 0
      , type = buf.readUInt32BE(pos)
      , mime = binary.decodeString(buf, 'ascii', pos += 4, pos += buf.readUInt32BE(pos - 4) )
      , desc = binary.decodeString(buf, 'utf8',  pos += 4, pos += buf.readUInt32BE(pos - 4) )
      , dim = {
            w: buf.readUInt32BE(pos), 
            h: buf.readUInt32BE(pos += 4), 
            depth:  buf.readUInt32BE(pos += 4), 
            colors: buf.readUInt32BE(pos += 4), 
        }

    return {
        type: 'PICTURE',
        value: {
            mime: mime,
            desc: desc,
            data: buf.slice(pos += 4,  pos += buf.readUInt32BE(pos - 4) ),
            info: dim
        }
    }
}

var HEADER_TYPES = {
        INFO:    0x1,
        COMMENT: 0x3,
        SETUP:   0x5,
    }


