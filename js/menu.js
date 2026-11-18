// Navegación del menú

const menuLinks = document.querySelectorAll('nav a[data-section]');
const sectionLinks = document.querySelectorAll('[data-section]');

sectionLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();

    const target = link.getAttribute('data-section');

    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(sec => {
      sec.classList.remove('active');
    });

    // Mostrar sección seleccionada
    const section = document.getElementById(target);
    if (section) section.classList.add('active');

    // Mantener activa la opción de navegación principal correspondiente.
    menuLinks.forEach(l => l.classList.remove('active'));
    const navTarget = document.querySelector(`nav a[data-section="${target}"]`);
    const fallbackNav = document.querySelector('nav a[data-section="inicio"]');
    (navTarget || fallbackNav)?.classList.add('active');

    // 🔥 Actualizar URL
    window.location.hash = target;
  });
});

// Activar sección según hash al cargar

document.addEventListener('DOMContentLoaded', () => {
  let hash = window.location.hash.replace('#', '');

  if (!hash || !document.getElementById(hash)) {
    hash = 'inicio';
  }

  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.remove('active');
  });

  const activeSection = document.getElementById(hash);
  if (activeSection) activeSection.classList.add('active');

  menuLinks.forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`nav a[data-section="${hash}"]`);
  const fallbackLink = document.querySelector('nav a[data-section="inicio"]');
  (activeLink || fallbackLink)?.classList.add('active');
});
