import { createContext, useEffect, useState } from "react";
import Proptypes from "prop-types";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  AuthProvider.propTypes = {
    children: Proptypes.node.isRequired,
  };
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const storedStudent = localStorage.getItem("student");
    if (storedStudent) {
      setStudent(JSON.parse(storedStudent));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ student, setStudent }}>
      {children}
    </AuthContext.Provider>
  );
};
