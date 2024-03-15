import { BrowserRouter, Routes, Route } from 'react-router-dom';

//Pages & Components
import Login from './pages/Login';
import Signup from './pages/Signup';


function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <div className="pages">
          <Routes>
            <Route
              path="/login"
              element={<Login />} 
            />
            <Route 
              path="/signup"
              element={<Signup />}
            />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
    
  );
}

export default App;
