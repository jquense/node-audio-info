var util = require("util")
  , fs = require('fs')
  , emitter = require('events').EventEmitter
  , binary   = require('../binaryHelpers')
  , toBuffer = require('./asfParser.js').toBuffer
  , dataCleaner = require('./metadataCleaner.js')
  , MpegInfo = require('./MpegInfoStream.js')
  , _ = require('lodash');

var mpegFrameKeys = [ 'bitRate', 'sampleRate', 'mode', 'channels', 'layer', 'version' ]

var magicNumber = {
        id3v2: new Buffer('ID3'),
        asf:   toBuffer('75B22630-668E-11CF-A6D9-00AA0062CE6C'),
        flac:  new Buffer('fLaC'),
        ogg:   new Buffer('OggS'),
        mp4:   function(chunk){
            return chunk.toString('binary', 4, 8) === 'ftyp'
        }
    },
    defaults = {
        defaultToId3v1: true,    
    }



function AudioInfo(file, size, opts){
    var self = this;
    emitter.call(this)

    //if ( !(file instanceof require('stream').Readable) )
    //    file = fs.createReadStream(file);
    //    file.on('error', function(err){
    //        self.emit(err)
    //    })
    //}

    this.options = _.extend({}, defaults, opts);
    this.metadata = {};
    this.stream = file;
    this.size = size;
    this.stream.once('readable', this.startParser.bind(this));
}

util.inherits(AudioInfo, emitter);

AudioInfo.prototype.startParser = function() {
    var self   = this
      , chunk  = this.stream.read()
      , type   = this.checkTagType(chunk)
      , isMpeg = ( type === 'id3v2' || type === 'id3v1' )
      , parser = type && new require('./'+ type + 'Parser')();
    
    if ( !parser ) {
        var err = new Error("Not a supported audio file", 1);
        err.type = "AudioInfoNotFoundError";
        return this.emit('error', err);
    }
        

    if ( isMpeg) {
        this.mpegParsing(parser, type)
    } else {
        parser.on('end', function(){
            self.finish()  
        })
    }

    parser.on('data', this.readInfo.bind(this))
    parser.on('error', function(err){
        parser.removeAllListeners('end')
        self.stream.unpipe(parser)
        self.emit('error', err)
    }) 

    this.stream.pipe(parser)
    this.stream.unshift(chunk);
}

AudioInfo.prototype.mpegParsing = function(tagParser, type) {
    var self = this
      , finish = _.after(2, self.finish).bind(this)
      , v2 = type === 'id3v2'
      , frameParser = new MpegInfo()
      , readSize = 0;
    
    if ( !v2 ) self.stream.pipe( frameParser )

    tagParser.on('error', function(err){
        v2 && finish();
    })

    tagParser.on('end', function(tags){
        if ( v2 ) self.stream.unpipe(tagParser).pipe(frameParser)

        readSize += this.header.size || this.bytesRead;
        finish();
    })

    //tagParser.on('data', this.readInfo.bind(this))

    frameParser.once('data', function(frame){
        var info = _.pick(frame.value, 'bitRate', 'sampleRate', 'mode', 'channels', 'layer', 'version');
         
        self.stream.unpipe(frameParser)  
        self.readInfo({ type: 'duration', value: AudioInfo.getMp3Duration(readSize + this.bytesRead, info.bitRate, self.size) }) 
         
        _.each( mpegFrameKeys, function(key){
            self.readInfo({ type: key, value: frame[key] })  
        })

        finish()
    })
}



AudioInfo.prototype.checkTagType = function(chunk) {
    var type;

    _.each( magicNumber, function(n, key){ 
        if( ( typeof n === 'function' && n(chunk) ) || binary.bufferEqual(n, chunk.slice(0, n.length)))
            type = key;
    });
    
    return type || (this.options.defaultToId3v1 ? 'id3v1' : null) //assume its at the end  
}

AudioInfo.prototype.finish = function(tags) {
     this.emit('info', this.metadata)
}

AudioInfo.prototype.readInfo = function(data) {
    var name  = dataCleaner.getAlias(data.type)
      , value = data.value;

    if ( name ) {
        value = dataCleaner.parseValue(name, data.value)
        this._set(name, value)
    }

    this.emit(name || data.type, value)  
}

AudioInfo.prototype._set = function(key, value) {
    var data = this.metadata
      , tag = {};
    
    if ( !_.has(data, key) ) 
        return data[key] = value;
      
    tag[key] = value;

    _.merge(data, tag, function(a, b) {
        return _.isArray(a) 
            ? _.union(a, b) 
            : undefined;
    });
}

AudioInfo.getMp3Duration = function (byteTofirstFrame, bitRate, fileSize ) {
    return Math.floor((fileSize - byteTofirstFrame) / ( bitRate / 8)) || 0;
};

module.exports = AudioInfo;