import React from "react";

const Header = () => {
  return (
    <header className="w-full h-16 bg-gray-900 flex items-center justify-between px-10">
      <h1 className="text-white text-3xl font-bold">My Website</h1>
      <nav className="flex items-center gap-10">
        <a href="/customizer" className="text-white text-lg">
          Customizer
        </a>
        <a href="/ecomerce" className="text-white text-lg">
          Ecomerce
        </a>
        <a href="#" className="text-white text-lg">
          Client
        </a>
      </nav>
    </header>
  );
};

export default Header;
