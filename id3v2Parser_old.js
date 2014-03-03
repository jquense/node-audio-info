var emitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , binary = require('../binaryHelpers')
  , _ = require('lodash')
  , TAG_EVENT = 'metadata'
  , Id3Frame = require('./id3v2Frame.js');

var location = {
    HEADER: 1,
    XHEADER: 2,
    FRAME_HEADER: 3,
    FRAME_DATA: 4,
};

function Id3v2Parser(stream, done){
    var self = this;

    emitter.call(this)

    self.tags   = []
    this.stream = stream;
    this.loc    = location.HEADER;
    this.bytesRead = 0;

    _.bindAll(this, [ '_readListener' ])
}

inherits(Id3v2Parser, emitter);

Id3v2Parser.prototype.parse = function() {
    stream.on('readable', this._readListener ) 
};

Id3v2Parser.prototype._readListener = function(){
    var buf
      , self = this
      , frame = self._currentFrame
      , size;

    self._hasData = true

    while ( self.loc && self._hasData && !self._done) {
        switch (self.loc){
            case location.HEADER:
                header = self.readTagHeader()
                
                if ( header ) {
                    self.loc += 2;
                    self.emit('header', header)
                    _.extend(self, header);
                }

                if ( header && header.flags.xheader) self.loc--;

                header = null;
                break;

            case location.XHEADER:
                self.skipXHeader()
                self.loc++
                self.emit('xheader')
                break;

            case location.FRAME_HEADER:
                frame = self._currentFrame = new Id3Frame(self.flags, self.version)

                if ( frame.parseHeader( self.read(frame.getHeaderSize()) ) ) {
                    if ( frame.isValid() ) {
                        self.loc++; 
                        self.emit('frame_header', frame.header)   
                    } else 
                        self.close()
                }

                break;
            case location.FRAME_DATA:
                if ( frame.parseFrameData( self.read( frame.getFrameDataSize() ) ) ) {
                    self.emit(TAG_EVENT, frame.header.id, frame.tag)
                    self.loc--
                }
                break;
        }
    } 
}

Id3v2Parser.prototype.close = function(){
    this._done = true;
    this.stream.removeListener('readable', this._readListener)
    this.emit('done')
}

Id3v2Parser.prototype.read = function(n){
    var buff = this.stream.read(n);

    if ( buff === null ) 
        this._hasData = false;
    else
        this.bytesRead += buff.length;    

    return buff;
}

Id3v2Parser.prototype.skipXHeader = function(){
    var buf  = this.stream.read(4)
      , size = buf && buf.readUInt32BE() - 4 ;
    
    if ( buff === null ) return;

    this.stream.read(size);
}

Id3v2Parser.prototype.readTagHeader = function(){
    var buf = this.read(10)
      , title = buf ? buf.toString('utf8', 0, 3) : '';

    if ( title === 'ID3' && buf.readUInt8(3) < 0xFF && buf.readUInt8(6) < 0x80 ) {
        return {
            version: { 
                major: 2, 
                minor: buf[3], 
                rev:   buf[4] 
            },
            flags: {
                unsync:       binary.getBit(buf, 5, 7),
                xheader:      binary.getBit(buf, 5, 6),
                experimental: binary.getBit(buf, 5, 5),
                footer:       binary.getBit(buf, 5, 4)
            },
            size: binary.syncSafe32Int(buf, 6)     
        }
    }
}


module.exports = Id3v2Parser;
