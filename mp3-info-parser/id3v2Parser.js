﻿var inherits = require('util').inherits
  , Tokenizr = require('../tokenStream')
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

module.exports = Id3v2Parser;

inherits(Id3v2Parser, Tokenizr);

function Id3v2Parser(){
    if ( !(this instanceof Id3v2Parser) ) 
        return new Id3v2Parser();

    Tokenizr.call(this, {objectMode: true})

    var notFound = new Error("does not contain ID3v2 tags");    
    notFound.type = "AudioInfoNotFoundError";

    this.isEqual(new Buffer('ID3', 'utf8'), notFound)
        .readBuffer(7, this.parseHeader)
        .tap(this.handleXHeader)
        .loop(this.parseTags)
        .tap(function(){
            this.push(null)
            //this.emit('done')
        })

}

Id3v2Parser.prototype.parseHeader = function(buf, toks){
    toks.header = {
        version: { 
            major: 2, 
            minor: buf[0], 
            rev:   buf[1] 
        },
        flags: {
            unsync:       binary.getBit(buf, 2, 7),
            xheader:      binary.getBit(buf, 2, 6),
            experimental: binary.getBit(buf, 2, 5),
            footer:       binary.getBit(buf, 2, 4)
        },
        size: binary.syncSafe32Int(buf, 3)     
    }
}

Id3v2Parser.prototype.parseTags = function(end, toks){
    var header = this.header = toks.header
    var frame = new Id3Frame(header.flags, header.version)

    this.readBuffer(frame.getHeaderSize(), 'frm_header')
        .tap(function(tok){
            frame.parseHeader(tok.frm_header)

            if ( !frame.isValid() ) 
                return end()

            this.readBuffer(frame.getFrameDataSize(), function(b){
                frame.parseFrameData(b)

                this.push({ type: frame.header.id, value: frame.tag })
            })
    })
   
}


Id3v2Parser.prototype.handleXHeader = function(tok){
    if ( tok.header.flags.xheader )
        this.readUInt32BE('xheader_len')
            .tap(function(tok){
                this.skip(tok.xheader_len - 4)
            })
}

