var emitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , binary = require('../binaryHelpers')
  , _ = require('lodash')
  , Id3v2 = require('./id3v2Parser.js')
  , MpegInfo = require('./MpegInfoStream.js');

var V1 = 'id3v1'
  , V2 = 'id3v2';


function MpegParser(stream, opts){
    var self = this;

    if ( !(self instanceof mpegParser) ) 
        return new mpegParser(stream);

    emitter.call(this)

    self.tags   = []
    this.stream = stream;
    this.infoStream = new MpegInfo();

    
}

inherits(mpegParser, emitter);

MpegParser.prototype.parse = function() {
    stream.once('readable', this._readListener.bind(self) ) 
};

MpegParser.prototype.getTagType = function(chunk) {
    return binary.bufferEqual(new Buffer('ID3'), chunk.slice(0, 3)) 
        ? V2
        : V1
}

MpegParser.prototype._readListener = function(){
    var self = this
      , stream = this.stream
      , info   = this.infoStream
      , chunk = stream.read()
      , type  = this.getTagType(chunk)
      , read  = 0 
      , tagParser = require('./' + type + 'Parser');

     if ( type === V2 ) {
        this.tagParser = new tagParser(stream);

        this.tagParser.on('done', function(tags){
            read = this.size || this.bytesRead;

            stream.pipe(info)
            self.tags = tags;
        })
 
        info.once('frame', function(frame){
            read += this.bytesRead;

            _.extend(self.tags, frame)

            self.tags.bytesToFirstFrame = read;

            stream.unpipe(info);
        })

        stream.unshift(chunk)
    }
       
}

MpegParser.prototype.finish = function(data){
    
}

MpegParser.prototype._close = function(data){
    this._done = true;

    this.stream.removeListener('readable', this._readListener)
    this.emit('done')
    this.cb && this.cb(data)
}

module.exports = MpegParser;
