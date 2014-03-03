var Transform = require('stream').Transform
  , inherits = require('util').inherits
  , _ = require('lodash')
  , TAG_EVENT = 'metadata'
  , enc = 'ascii';

module.exports = Id3v1Parser;

function Id3v1Parser(){
    if ( !(this instanceof Id3v1Parser) ) 
        return new Id3v1Parser();

    Transform.call(this, { objectMode: true })
}

inherits(Id3v1Parser, Transform);

Id3v1Parser.prototype._transform = function(chunk, enc, done) {
    this._lastChunk = chunk;

    done();
};

Id3v1Parser.prototype._flush = function(done) {
    done();
    this._parseTags();
};



Id3v1Parser.prototype._parseTags = function(){
    var chunk  = this._lastChunk
      , off = chunk.length - 128
      , err;

    if ( getString(chunk, off, off += 3 ) !== 'TAG' ) {
        err = new Error("Not a valid ID3v1 tag")      
        err.type = "AudioInfoNotFoundError";
        this.emit('error', err)
    }
        
    
    this.push( 'title',   getString(chunk, off, off += 30 ))
    this.push( 'artist',  getString(chunk, off, off += 30 ))
    this.push( 'album',   getString(chunk, off, off += 30 ))
    this.push( 'year',    getString(chunk, off, off += 4  ))
    this.push( 'comment', getString(chunk, off, off += 28 ))

    this.push( 'track',   chunk[off += 1])
    this.push( 'genre',   chunk[off += 1])

    this.push(null);
    
}

Id3v1Parser.prototype.push = function tag(tag, value){
    if ( arguments.length === 1 && tag === null ) 
        return Transform.prototype.push.call(this, null)

    Transform.prototype.push.call(this, {
        type: tag,  
        value: value  
    });
}

function getString(buf, start, end){
    return buf.toString(enc, start, end).trim().replace(/\x00/g, '')
}

