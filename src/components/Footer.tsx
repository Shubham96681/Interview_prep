import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="py-12 px-6 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#ffffff"/>
                </svg>
              </div>
              <div className="text-xl font-bold text-white">InPrepare</div>
            </div>
            <p className="text-gray-400 text-sm">
              Modern AI-Integrated Interview Preparation Platform. Transform your interview experience with personalized coaching and expert instructors.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">LEARNING</h3>
            <ul className="space-y-2">
              <li><button onClick={() => navigate('/experts')} className="text-gray-400 hover:text-white transition-colors text-sm">Browse Experts</button></li>
              <li><button onClick={() => navigate('/services')} className="text-gray-400 hover:text-white transition-colors text-sm">Live Sessions</button></li>
              <li><button onClick={() => navigate('/experts')} className="text-gray-400 hover:text-white transition-colors text-sm">Find Instructors</button></li>
              <li><button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors text-sm">Certificates</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">SUPPORT</h3>
            <ul className="space-y-2">
              <li><button onClick={() => navigate('/contact')} className="text-gray-400 hover:text-white transition-colors text-sm">Help Center</button></li>
              <li><button onClick={() => navigate('/contact')} className="text-gray-400 hover:text-white transition-colors text-sm">Contact Us</button></li>
              <li><button onClick={() => navigate('/contact')} className="text-gray-400 hover:text-white transition-colors text-sm">FAQ</button></li>
              <li><button onClick={() => navigate('/contact')} className="text-gray-400 hover:text-white transition-colors text-sm">Feedback</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">COMPANY</h3>
            <ul className="space-y-2">
              <li><button onClick={() => navigate('/about')} className="text-gray-400 hover:text-white transition-colors text-sm">About Us</button></li>
              <li><button onClick={() => navigate('/about')} className="text-gray-400 hover:text-white transition-colors text-sm">Mission</button></li>
              <li><button onClick={() => navigate('/about')} className="text-gray-400 hover:text-white transition-colors text-sm">Team</button></li>
              <li><button onClick={() => navigate('/contact')} className="text-gray-400 hover:text-white transition-colors text-sm">Careers</button></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            © 2024 InPrepare. All rights reserved.
          </p>
          <div className="flex gap-6">
            <button className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</button>
            <button className="text-gray-400 hover:text-white transition-colors text-sm">Terms of Service</button>
            <button className="text-gray-400 hover:text-white transition-colors text-sm">Cookie Policy</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

