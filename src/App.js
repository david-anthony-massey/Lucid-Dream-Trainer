import React, { Component } from 'react';
import { Link } from 'react-router-dom';

class PlaySound extends Component {
  constructor(props) {
    super(props);

    this.state = {
      play: true,
    };
    this.audio = new Audio();
    this.audio.src = 'bad_apple.mp3';
    this.audio.volume = 0.0006;
    this.audio.addEventListener(
      'ended',
      function() {
        this.currentTime = 0;
        this.play();
      },
      false,
    );
  }

  render() {
    this.audio.volume = 0.0006;
    this.audio.play();
    return (
      <div>
        <button id="audioBtn" onClick={this.togglePlay}></button>
      </div>
    );
  }
}

export default class App extends React.Component {
  render() {
    return (
      <div>
        {/* <PlaySound></PlaySound> */}
        <h1>Home page</h1>
        <Link to="/profile">Go back to profile</Link>
        <div>
          <img src="https://www.bestsadstatus.com/wp-content/uploads/2019/09/whatsapp-dp-for-girls-6.jpg"></img>
        </div>
      </div>
    );
  }
}
