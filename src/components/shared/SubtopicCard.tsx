import React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface AccordionCardProps {
  id: number;
  title: string;
  expanded: boolean;
  onToggle: (id: number) => void;
  children: React.ReactNode;
}

const AccordionCard: React.FC<AccordionCardProps> = ({
	id,
	title,
	expanded,
	onToggle,
	children,
}) => (
	<div className="rounded-lg shadow-md lg:w-11/12 sm:w-[95%] -ml-60 lg:ml-0  md:-ml-30 md:w-[100%]">
		{" "}
		{/* Card Header */}
		<div
			className="relative px-4 py-3.5 cursor-pointer flex items-center transition-all duration-200 bg-gradient-to-r from-[#800000]/5 via-[#800000]/3 to-transparent hover:from-[#800000]/8 hover:via-[#800000]/5 hover:to-transparent"
			onClick={() => onToggle(id)}
		>
			<div className="flex items-center w-full">
				<div className="flex-shrink-0 mr-3">
					<ChevronDownIcon
						className={`h-5 w-5 text-[#800000] transition-transform duration-300 ${
							expanded ? "rotate-180" : ""
						}`}
					/>
				</div>
				<div className="text-sm text-[#800000] tracking-wide">{title}</div>
			</div>
			<div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#800000]/20 rounded-l-full" />
		</div>
		{/* Card Content */}
		<div
			className={`transition-[max-height] duration-1000 ease-in-out bg-[#f8f9fa] ${
				expanded ? "max-h-[1000px] overflow-visible" : "max-h-0 overflow-hidden"
			}`}
		>
			{expanded && <div className="p-4">{children}</div>}
		</div>
	</div>
);

export default AccordionCard;
