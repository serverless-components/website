import React, { useState } from 'react';
import imageHero from './images/hero.png';

const App = () => {
  const [votes, setVotes] = useState(0);

  return (
    <div className="container">
      <div className="hero">
        <img src={imageHero} />
      </div>

      <div className="tagline">
        a website built on serverless components via the serverless framework
      </div>

      <div className="buttonContainer">
        <div
          className={`button`}
          onClick={() => { setVotes(votes + 1) }}
        >
          <div className={`buttonInner`}>
            <div className={`buttonLeft`}>ß</div>
            <div className="buttonRight">{votes}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
