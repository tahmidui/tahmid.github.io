#import "@preview/basic-resume:0.2.9": *

#let name = "Tahmid Ul Islam"
#let location = "Lubbock, TX"
#let email = "tahmid.ul.islam71@outlook.com"
#let github = "github.com/tahmidui"
#let linkedin = "linkedin.com/in/tahmidui"
#let phone = "+1 (806) 283-3040"
#let personal-site = "tahmidulislam.me"

#show: resume.with(
  author: name,
  // location: location,
  email: email,
  github: github,
  linkedin: linkedin,
  phone: phone,
  personal-site: personal-site,
  accent-color: "#26428b",
  font: "New Computer Modern",
  paper: "us-letter",
  author-position: left,
  personal-info-position: left,
)

== Education

#edu(
  institution: "Texas Tech University, Rawls College of Business",
  location: "Lubbock, TX",
  dates: "May 2027",
  degree: "Master of Science in Data Science",
)
- Cumulative GPA: 4.00\/4.0
// - Relevant Coursework: Data Structures, Program Development, Microprocessors, Abstract Algebra I: Groups and Rings, Linear Algebra, Discrete Mathematics, Multivariable & Single Variable Calculus, Principles and Practice of Comp Sci

#edu(
  institution: "Texas Tech University, College of Arts & Sciences",
  location: "Lubbock, TX",
  dates: "May 2026",
  degree: "Master of Arts in Sociology",
)
- Cumulative GPA: 4.00\/4.0
- Thesis: Religion and Subjective Well-Being: Comparing the Influence of Religious Beliefs and Practices

#edu(
  institution: "University of Dhaka, Faculty of Social Sciences",
  location: "Dhaka, Bangladesh",
  dates: "October 2024",
  degree: "Master of Social Sciences in Sociology",
)
- Cumulative GPA: 3.53\/4.0

#edu(
  institution: "University of Dhaka, Faculty of Social Sciences",
  location: "Dhaka, Bangladesh",
  dates: "October 2024",
  degree: "Bachelor of Social Sciences in Sociology",
)
- Cumulative GPA: 3.53\/4.0

== Projects

#project(
  name: "Healthcare Database Design",
  role: "SQL, MySQL Workbench, ERD Modeling",
  dates: dates-helper(
    start-date: "June 2026",
    end-date: "July 2026",
  ),
)
- Designed a relational database schema and ER diagram with 9 entities and 4 bridge tables, connecting clinical and financial operations
- Assisted with the SQL database implementation in MySQL Workbench and co-presented project outcomes

#project(
  name: "Religion and Subjective Well-Being",
  role: "Stata SE 15.1",
  dates: dates-helper(
    start-date: "December 2025",
    end-date: "March 2026",
  ),
)
- Investigated the association between religiosity and subjective well-being, comparing the relative influence of religious beliefs and practices
- Cleaned and recoded flat-file survey data (World Values Survey, Wave 7) in Stata for statistical analysis
- Performed descriptive statistics and multiple linear regression; reported findings in a master's thesis

== Work Experience

#work(
  title: "Graduate Teaching Assistant",
  location: "Lubbock, Texas",
  company: "Texas Tech University",
  dates: dates-helper(
    start-date: "September 2024",
    end-date: "May 2026",
  ),
)

Department of Sociology, Anthropology, and Social Work

- Instructed core topics of Sociology of Religion as part of an undergraduate course
- Developed and applied grading rubrics for assignments, ensuring fair, consistent evaluation
- Delivered personalized feedback on student work through written comments and consultations

#work(
  title: "Instructor, Content Reviewer, Quiz Creator",
  location: "Dhaka, Bangladesh",
  company: "10MS Limited",
  dates: dates-helper(
    start-date: "May 2019",
    end-date: "April 2022",
  ),
)
- Produced 114+ asynchronous video tutorials covering high school sociology curriculum
- Developed supplemental educational materials, including presentation slides and quizzes
- Contributed to quality assurance to ensure accuracy and maintain pedagogical standards

== Technical Skills

*Data Analysis & Programming:* SQL, Python (pandas), R (tidyverse), Stata

*Statistical Methods:* Linear Regression, Survey Analysis

*Databases:* MySQL, PostgreSQL, Relational Data Modeling (ERD)

*Data Visualization & BI:* Tableau, Excel, ggplot2, Seaborn

*Tools & Environments:* Git/GitHub, Linux/CLI, VS Code, RStudio, Jupyter
