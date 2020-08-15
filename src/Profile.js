import React from 'react';
import { Link } from 'react-router-dom';
import Say from 'react-say';
let word = new SpeechSynthesisUtterance('Hey');
let bool = true;
export default class Profile extends React.Component {
  render() {
    if (bool) {
      bool = !bool;
      return (
        <div>
          <h1>This is my profile</h1>
          <Link to="/">Go back to home</Link>
          <div>
            <img src="https://www.bestsadstatus.com/wp-content/uploads/2019/09/whatsapp-dp-for-girls-17.jpg"></img>
            {speechSynthesis.speak(word)}
          </div>
        </div>
      );
    } else {
      bool = !bool;
      return (
        <div>
          <h1>This should play a sound</h1>
          <Link to="/">Go back to home</Link>
        </div>
      );
    }
  }
}
