import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

export default function Dashboard() {
  const location = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projects, setProjects] = useState([]);

  // Save JWT token from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
    }

    loadProjects();
  }, [location.search]);

  const createProject = async () => {
    try {
      const token = localStorage.getItem("token");

      await axios.post(
        "http://localhost:5001/api/projects",
        { title, description },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTitle("");
      setDescription("");
      loadProjects();

    } catch (error) {
      console.error(error);
      alert("Error creating project");
    }
  };

  const loadProjects = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await axios.get(
        "http://localhost:5001/api/projects",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setProjects(response.data);

    } catch (error) {
      console.error(error);
    }
  };
const getUserFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));

    return payload.sub;
  } catch {
    return null;
  }
};

const user = getUserFromToken();

  return (
    <MainLayout user={user}>
    <div className="content">

      {/* Header */}
      <div className="card">
        <h2>Publishing Projects</h2>

        <div className="form-row">
          <input
            placeholder="Project Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />

          <textarea
            placeholder="Project Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea"
          />

          <button onClick={createProject}>
            Create Project
          </button>
        </div>
      </div>


      {/* Projects Grid */}
      <div className="projects-grid">

        {projects.map((p) => (
          <div className="project-card" key={p.id}>

            <h3>{p.title}</h3>

            <p>{p.description}</p>

            <Link
              to={`/project/${p.id}`}
              className="open-btn"
            >
              Open Project →
            </Link>

          </div>
        ))}

      </div>

    </div>
  </MainLayout>
  );
}