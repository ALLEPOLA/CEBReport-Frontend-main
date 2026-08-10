import {useState, useEffect} from "react";
import { useRoleBasedSubtopics } from "../hooks/useRoleBasedSubtopics";
import SubtopicCard from "../components/shared/SubtopicCard";
import { useReportRenderer } from "../hooks/useReportRenderer";

const Construction = () => {
    const { subtopics, selectedSubtopicId } = useRoleBasedSubtopics(["FIFO"]);
    const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const renderReport = useReportRenderer();

    useEffect(() => {
        if (typeof selectedSubtopicId === "number") {
            setExpandedCard(selectedSubtopicId);
        }
    }, [selectedSubtopicId]);

    const toggleCard = (id: number) => {
        setExpandedCard((prev) => (prev === id ? null : id));
    };

    return (
        <div className="flex flex-col gap-4 pt-4 px-10">
            {subtopics.map((subtopic) => (
                <SubtopicCard
                    key={subtopic.id}
                    id={subtopic.id}
                    title={subtopic.name}
                    expanded={expandedCard === subtopic.id}
                    onToggle={toggleCard}
                >
                    {renderReport(subtopic.name, subtopic.repIdNo ?? String(subtopic.id))}
                </SubtopicCard>
            ))}
        </div>
    );
};

export default Construction;





