// // import ceblogo from "../assets/ceb-wave.png";
// import LoginCard from "../components/login/LoginCard";

// const LoginPage = () => {
//   return (
// 		<main className="min-h-screen w-full">
// 			<section className="relative w-full min-h-screen bg-[#f8f8f8] flex items-center justify-center px-4 sm:px-6 lg:px-8">
// 				{/* <div
// 					className="absolute inset-x-0 bottom-0 w-full"
// 					style={{
// 						backgroundImage: `url(${ceblogo})`,
// 						backgroundRepeat: "no-repeat",
// 						backgroundSize: "100% auto",
// 						height: "400px",
// 						opacity: 0.8,
// 						zIndex: -1,
// 					}}
// 				></div> */}

// 				<div className="w-full max-w-md opacity-80">
// 					<LoginCard />
// 				</div>

// 				{/* <p className="absolute bottom-4 right-4 text-xs text-gray-600 opacity-70">
// 					Version 1.2
// 				</p> */}
// 			</section>
// 		</main>
//   );
// };

// export default LoginPage;

import LoginCard from "../components/login/LoginCard";

const LoginPage = () => {
  return (
    <main className="min-h-screen w-full">
      <section className="w-full min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.15)]">
          <LoginCard />
        </div>
        <p className="absolute bottom-4 right-4 text-xs text-gray-600 opacity-70">
          Version 1.6
        </p>
      </section>
    </main>
  );
};

export default LoginPage;
