import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "../utils/firebase";
import { Button } from "@/components/ui/button";

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    signInWithGoogle(navigate);
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <Button onClick={handleLogin}>Login with Google</Button>
    </div>
  );
};

export default Login;
