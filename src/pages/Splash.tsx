import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { IonPage, IonContent } from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import "./Splash.css";

const Splash: React.FC = () => {
  const history = useHistory();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const t = setTimeout(() => {
      if (user) {
        history.push(user.role === 'PACIENTE' ? "/patient/home" : "/care/home");
      } else {
        history.push("/welcome");
      }
    }, 3000);

    return () => clearTimeout(t);
  }, [loading, user, history]);

  return (
    <IonPage>
      <IonContent fullscreen className="splash-screen">
        <img src="/logo3d.png" alt="Pastibot Logo" className="logo" />
      </IonContent>
    </IonPage>
  );
};

export default Splash;
