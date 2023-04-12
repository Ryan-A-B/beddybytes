import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FunctionComponent = () => {
    return (
        <div>
            <h1>Home</h1>
            <Link to="/camera" className="btn btn-primary">Camera</Link>
            <Link to="/monitor" className="btn btn-primary">Monitor</Link>
        </div>
    );
};

export default Home;